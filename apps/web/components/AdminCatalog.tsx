"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtNGN, fmtCAD } from "@/lib/format";
import {
  TRANSMISSIONS,
  FUEL_TYPES,
  COLOURS,
  TRANSMISSION_LABEL,
  FUEL_LABEL,
} from "@/lib/vehicle-spec";
import type {
  AdminVehicleListItem,
  AdminVehicleEdit,
  AdminShippingRow,
} from "@/lib/types";

/**
 * Resize an image to a max edge in the browser and re-encode to JPEG, keeping
 * uploads small enough to post through a serverless function (Blob put() runs
 * server-side on OIDC — no read-write token needed).
 */
async function downscaleImage(file: File, maxEdge = 1920, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, maxEdge / longest);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new Error("Canvas not supported");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Image encode failed"))),
      "image/jpeg",
      quality,
    );
  });
}

const BODY_TYPES = ["SUV", "SEDAN", "HATCHBACK", "WAGON", "COUPE", "TRUCK", "VAN", "OTHER"];

const STATUS_TONE: Record<string, string> = {
  DRAFT: "var(--steel-dim)",
  AVAILABLE: "var(--stamp)",
  RESERVED: "var(--amber)",
  SOLD: "var(--frost)",
  ARCHIVED: "var(--steel-dim)",
};

const TRANSITIONS: Record<string, { label: string; to: string }[]> = {
  DRAFT: [
    { label: "Publish", to: "AVAILABLE" },
    { label: "Archive", to: "ARCHIVED" },
  ],
  AVAILABLE: [
    { label: "Unpublish", to: "DRAFT" },
    { label: "Archive", to: "ARCHIVED" },
  ],
  ARCHIVED: [{ label: "Restore to draft", to: "DRAFT" }],
  RESERVED: [],
  SOLD: [],
};

const input: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,.03)",
  border: "1px solid var(--rule)",
  borderRadius: 8,
  color: "var(--frost)",
  padding: "9px 11px",
  fontSize: 13,
  // render native popups (select list, date picker) dark instead of white
  colorScheme: "dark",
};
// Explicit option colours so the open <select> list is readable even on
// browsers that ignore color-scheme for option text.
const opt: React.CSSProperties = { background: "#101F1C", color: "#E7EEEB" };
const label: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "var(--steel-dim)",
  marginBottom: 5,
  display: "block",
};

interface CoreForm {
  make: string;
  model: string;
  year: string;
  trim: string;
  bodyType: string;
  mileageKm: string;
  conditionGrade: string;
  transmission: string;
  fuelType: string;
  colour: string;
  vin: string;
  description: string;
  purchasePriceCAD: string;
  defaultShippingMethod: string;
  handlingRateOverride: string;
}

const BLANK: CoreForm = {
  make: "", model: "", year: "", trim: "", bodyType: "SUV", mileageKm: "",
  conditionGrade: "", transmission: "", fuelType: "", colour: "",
  vin: "", description: "", purchasePriceCAD: "",
  defaultShippingMethod: "RORO", handlingRateOverride: "",
};

function formFrom(v: AdminVehicleEdit): CoreForm {
  return {
    make: v.make, model: v.model, year: String(v.year), trim: v.trim ?? "",
    bodyType: v.bodyType, mileageKm: String(v.mileageKm), conditionGrade: v.conditionGrade,
    transmission: v.transmission ?? "", fuelType: v.fuelType ?? "", colour: v.colour ?? "",
    vin: v.vin ?? "", description: v.description, purchasePriceCAD: v.purchasePriceCAD,
    defaultShippingMethod: v.defaultShippingMethod,
    handlingRateOverride: v.handlingRateOverride ?? "",
  };
}

function Field({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}>{children}</div>;
}

function Badge({ status }: { status: string }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 9, letterSpacing: 1, textTransform: "uppercase",
        color: STATUS_TONE[status] ?? "var(--frost)",
        border: `1px solid ${STATUS_TONE[status] ?? "var(--rule)"}`,
        borderRadius: 6, padding: "2px 7px",
      }}
    >
      {status}
    </span>
  );
}

export function AdminCatalog({ vehicles }: { vehicles: AdminVehicleListItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminVehicleEdit | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CoreForm>(BLANK);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const open = editing !== null || creating;

  /** Sub-mutation routes all return the fresh AdminVehicleEdit. */
  async function call(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(url + method);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((j as { error?: string }).error ?? "Request failed");
        return false;
      }
      if (j && typeof j === "object" && "shippingOptions" in j) {
        setEditing(j as AdminVehicleEdit);
      }
      return true;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  function openNew() {
    setForm(BLANK);
    setEditing(null);
    setCreating(true);
    setError(null);
    setNotice(null);
  }

  async function openEdit(id: string) {
    setError(null);
    setNotice(null);
    setBusy("load");
    try {
      const res = await fetch(`/api/admin/vehicles/${id}`);
      if (!res.ok) {
        setError("Could not load vehicle");
        return;
      }
      const v = (await res.json()) as AdminVehicleEdit;
      setEditing(v);
      setForm(formFrom(v));
      setCreating(false);
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  function close() {
    setEditing(null);
    setCreating(false);
    setError(null);
    setNotice(null);
    router.refresh();
  }

  async function saveCore() {
    if (!form.transmission || !form.fuelType || !form.colour) {
      setError("Transmission, fuel type and colour are required.");
      return;
    }
    const payload = {
      make: form.make,
      model: form.model,
      year: Number(form.year),
      trim: form.trim || null,
      bodyType: form.bodyType,
      mileageKm: Number(form.mileageKm),
      conditionGrade: form.conditionGrade,
      transmission: form.transmission,
      fuelType: form.fuelType,
      colour: form.colour,
      vin: form.vin || null,
      description: form.description,
      purchasePriceCAD: form.purchasePriceCAD,
      defaultShippingMethod: form.defaultShippingMethod,
      handlingRateOverride: form.handlingRateOverride || null,
    };

    if (creating) {
      setBusy("create");
      setError(null);
      try {
        const res = await fetch("/api/admin/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((j as { error?: string }).error ?? "Could not create vehicle");
          return;
        }
        // load the full editable shape so sub-sections appear
        const id = (j as { id: string }).id;
        const fresh = await fetch(`/api/admin/vehicles/${id}`);
        const v = (await fresh.json()) as AdminVehicleEdit;
        setEditing(v);
        setForm(formFrom(v));
        setCreating(false);
        setNotice("Draft created. Add shipping, clearing and photos, then publish.");
      } catch {
        setError("Network error");
      } finally {
        setBusy(null);
      }
    } else if (editing) {
      const ok = await call(`/api/admin/vehicles/${editing.id}`, "PATCH", payload);
      if (ok) setNotice("Saved.");
    }
  }

  async function onUpload(files: FileList | null) {
    if (!editing || !files || files.length === 0) return;
    setBusy("upload");
    setError(null);
    setNotice(null);
    try {
      for (const file of Array.from(files)) {
        // Downscale in the browser so the upload stays well under the 4.5MB
        // serverless body cap; fall back to the original if decode fails.
        let payload: Blob = file;
        let filename = file.name;
        try {
          payload = await downscaleImage(file);
          filename = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        } catch {
          payload = file;
        }
        const fd = new FormData();
        fd.append("file", payload, filename);
        const res = await fetch(`/api/admin/vehicles/${editing.id}/photos`, {
          method: "POST",
          body: fd, // browser sets the multipart boundary; do not set Content-Type
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((j as { error?: string }).error ?? "Could not save photo");
          break;
        }
        setEditing(j as AdminVehicleEdit);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  function movePhoto(index: number, dir: -1 | 1) {
    if (!editing) return;
    const order = editing.photos.map((p) => p.id);
    const j = index + dir;
    if (j < 0 || j >= order.length) return;
    [order[index], order[j]] = [order[j]!, order[index]!];
    void call(`/api/admin/vehicles/${editing.id}/photos`, "PATCH", { order });
  }

  // ---------------------------------------------------------------- list view
  if (!open) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0 16px" }}>
          <h2 className="exp" style={{ fontSize: 18, fontWeight: 800 }}>Catalog · {vehicles.length} vehicles</h2>
          <button className="btn btn-buy" onClick={openNew}>+ New vehicle</button>
        </div>

        {error && <Alert tone="warn">{error}</Alert>}

        {vehicles.length === 0 ? (
          <p style={{ color: "var(--steel-dim)", padding: "24px 4px" }}>No vehicles yet. Create your first listing.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {vehicles.map((v) => (
              <button
                key={v.id}
                onClick={() => openEdit(v.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                  border: "1px solid var(--rule)", borderRadius: 12, padding: 10,
                  background: "rgba(255,255,255,.02)", cursor: "pointer", color: "inherit",
                }}
              >
                <div style={{ width: 72, height: 50, borderRadius: 8, overflow: "hidden", flex: "0 0 auto", background: "#0E211E", display: "grid", placeItems: "center" }}>
                  {v.coverPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.coverPhotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span className="mono" style={{ fontSize: 8, color: "var(--steel-dim)" }}>NO PHOTO</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{v.name}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--steel-dim)", marginTop: 3 }}>
                    {v.bodyType} · grade {v.conditionGrade} · {fmtCAD(v.purchasePriceCAD)}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <Badge status={v.status} />
                    <Tag ok={v.shippingCount > 0}>{v.shippingCount} shipping</Tag>
                    <Tag ok={v.hasClearing}>{v.hasClearing ? "clearing ✓" : "no clearing"}</Tag>
                    <Tag ok={v.photoCount > 0}>{v.photoCount} photo{v.photoCount === 1 ? "" : "s"}</Tag>
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--steel)" }}>Edit →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------- editor view
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0 16px" }}>
        <h2 className="exp" style={{ fontSize: 18, fontWeight: 800 }}>
          {creating ? "New vehicle" : editing ? `${editing.year} ${editing.make} ${editing.model}` : "Vehicle"}
        </h2>
        <button className="btn" style={ghost} onClick={close}>← Back to catalog</button>
      </div>

      {editing && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Badge status={editing.status} />
          {TRANSITIONS[editing.status]?.map((t) => (
            <button
              key={t.to}
              className="btn"
              style={t.to === "AVAILABLE" ? primary : ghost}
              disabled={busy !== null}
              onClick={async () => {
                const ok = await call(`/api/admin/vehicles/${editing.id}`, "PATCH", { status: t.to });
                if (ok) setNotice(`Status → ${t.to}`);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {error && <Alert tone="warn">{error}</Alert>}
      {notice && <Alert tone="ok">{notice}</Alert>}

      {/* ---- core fields ---- */}
      <Section title="Vehicle details">
        <Row>
          <Field><span style={label}>Make</span><input style={input} value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></Field>
          <Field><span style={label}>Model</span><input style={input} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
        </Row>
        <Row>
          <Field><span style={label}>Year</span><input style={input} inputMode="numeric" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></Field>
          <Field><span style={label}>Trim (optional)</span><input style={input} value={form.trim} onChange={(e) => setForm({ ...form, trim: e.target.value })} /></Field>
        </Row>
        <Row>
          <Field><span style={label}>Body type</span>
            <select style={input} value={form.bodyType} onChange={(e) => setForm({ ...form, bodyType: e.target.value })}>
              {BODY_TYPES.map((b) => <option key={b} value={b} style={opt}>{b}</option>)}
            </select>
          </Field>
          <Field><span style={label}>Mileage (km)</span><input style={input} inputMode="numeric" value={form.mileageKm} onChange={(e) => setForm({ ...form, mileageKm: e.target.value })} /></Field>
        </Row>
        <Row>
          <Field><span style={label}>Condition grade</span><input style={input} placeholder="A, A-, B+…" value={form.conditionGrade} onChange={(e) => setForm({ ...form, conditionGrade: e.target.value })} /></Field>
          <Field><span style={label}>VIN (optional)</span><input style={input} value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} /></Field>
        </Row>
        <Row>
          <Field><span style={label}>Transmission</span>
            <select style={input} value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })}>
              <option value="" style={opt} disabled>Select…</option>
              {TRANSMISSIONS.map((t) => <option key={t} value={t} style={opt}>{TRANSMISSION_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field><span style={label}>Fuel type</span>
            <select style={input} value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })}>
              <option value="" style={opt} disabled>Select…</option>
              {FUEL_TYPES.map((f) => <option key={f} value={f} style={opt}>{FUEL_LABEL[f]}</option>)}
            </select>
          </Field>
        </Row>
        <Field><span style={label}>Colour</span>
          <select style={input} value={form.colour} onChange={(e) => setForm({ ...form, colour: e.target.value })}>
            <option value="" style={opt} disabled>Select colour…</option>
            {COLOURS.map((c) => <option key={c} value={c} style={opt}>{c}</option>)}
          </select>
        </Field>
        <Row>
          <Field><span style={label}>Purchase price (CAD)</span><input style={input} inputMode="decimal" value={form.purchasePriceCAD} onChange={(e) => setForm({ ...form, purchasePriceCAD: e.target.value })} /></Field>
          <Field><span style={label}>Default shipping</span>
            <select style={input} value={form.defaultShippingMethod} onChange={(e) => setForm({ ...form, defaultShippingMethod: e.target.value })}>
              <option value="RORO" style={opt}>RORO</option>
              <option value="CONTAINER" style={opt}>CONTAINER</option>
            </select>
          </Field>
        </Row>
        <Field><span style={label}>Handling override (optional, e.g. 0.12)</span><input style={input} inputMode="decimal" value={form.handlingRateOverride} onChange={(e) => setForm({ ...form, handlingRateOverride: e.target.value })} /></Field>
        <Field><span style={label}>Description</span><textarea style={{ ...input, minHeight: 90, resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <button className="btn btn-buy" disabled={busy !== null} onClick={saveCore}>
          {creating ? "Create draft" : "Save details"}
        </button>
      </Section>

      {/* sub-sections only exist once the vehicle has an id */}
      {editing && (
        <>
          <ShippingEditor
            initial={editing.shippingOptions}
            busy={busy !== null}
            onSave={(options) => call(`/api/admin/vehicles/${editing.id}/shipping`, "PUT", { options })}
          />

          <ClearingEditor
            current={editing.clearing}
            busy={busy !== null}
            onSave={(payload) => call(`/api/admin/vehicles/${editing.id}/clearing`, "PUT", payload)}
          />

          <HistoryEditor
            current={editing.history}
            busy={busy !== null}
            onSave={(payload) => call(`/api/admin/vehicles/${editing.id}/history`, "PUT", payload)}
          />

          <Section title={`Photos · ${editing.photos.length}/12`}>
            {editing.photos.length === 0 ? (
              <p style={{ color: "var(--steel-dim)", marginBottom: 12 }}>No photos yet — the gallery shows generated art until you add one.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: 12 }}>
                {editing.photos.map((p, i) => (
                  <div key={p.id} style={{ border: "1px solid var(--rule)", borderRadius: 10, overflow: "hidden", position: "relative", background: "#0E211E" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" style={{ width: "100%", height: 84, objectFit: "cover", display: "block" }} />
                    {i === 0 && <span className="mono" style={{ position: "absolute", left: 6, top: 6, fontSize: 8, letterSpacing: 1, background: "var(--amber)", color: "#0B1413", borderRadius: 4, padding: "1px 5px" }}>COVER</span>}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: 6, gap: 4 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button style={mini} disabled={busy !== null || i === 0} onClick={() => movePhoto(i, -1)}>↑</button>
                        <button style={mini} disabled={busy !== null || i === editing.photos.length - 1} onClick={() => movePhoto(i, 1)}>↓</button>
                      </div>
                      <button style={{ ...mini, color: "var(--amber)" }} disabled={busy !== null} onClick={() => call(`/api/admin/vehicles/${editing.id}/photos/${p.id}`, "DELETE")}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <label style={{ ...primary, display: "inline-block", cursor: busy === "upload" ? "default" : "pointer", opacity: editing.photos.length >= 12 ? 0.5 : 1 }}>
              {busy === "upload" ? "Uploading…" : "Upload photos"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                disabled={busy !== null || editing.photos.length >= 12}
                style={{ display: "none" }}
                onChange={(e) => { void onUpload(e.target.files); e.target.value = ""; }}
              />
            </label>
            <p className="mono" style={{ fontSize: 9, color: "var(--steel-dim)", marginTop: 8 }}>
              First photo is the cover. JPEG/PNG/WebP/AVIF, up to 12 MB each.
            </p>
          </Section>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- sub-editors */

function ShippingEditor({
  initial,
  busy,
  onSave,
}: {
  initial: AdminShippingRow[];
  busy: boolean;
  onSave: (options: AdminShippingRow[]) => Promise<boolean>;
}) {
  const [rows, setRows] = useState<AdminShippingRow[]>(
    initial.length
      ? initial
      : [{ method: "RORO", containerType: null, costCAD: "", transitWeeksMin: 6, transitWeeksMax: 10 }],
  );

  const set = (i: number, patch: Partial<AdminShippingRow>) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <Section title="Shipping options">
      {rows.map((r, i) => (
        <div key={i} style={{ border: "1px solid var(--rule)", borderRadius: 10, padding: 10, marginBottom: 10 }}>
          <Row>
            <Field><span style={label}>Method</span>
              <select style={input} value={r.method} onChange={(e) => set(i, { method: e.target.value as AdminShippingRow["method"], containerType: e.target.value === "CONTAINER" ? r.containerType : null })}>
                <option value="RORO" style={opt}>RORO</option>
                <option value="CONTAINER" style={opt}>CONTAINER</option>
              </select>
            </Field>
            <Field><span style={label}>Container type</span>
              <select style={{ ...input, opacity: r.method === "CONTAINER" ? 1 : 0.4 }} disabled={r.method !== "CONTAINER"} value={r.containerType ?? ""} onChange={(e) => set(i, { containerType: (e.target.value || null) as AdminShippingRow["containerType"] })}>
                <option value="" style={opt}>—</option>
                <option value="SHARED" style={opt}>SHARED</option>
                <option value="SOLE" style={opt}>SOLE</option>
              </select>
            </Field>
          </Row>
          <Row>
            <Field><span style={label}>Cost (CAD)</span><input style={input} inputMode="decimal" value={r.costCAD} onChange={(e) => set(i, { costCAD: e.target.value })} /></Field>
            <Field><span style={label}>Transit weeks (min / max)</span>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={input} inputMode="numeric" value={r.transitWeeksMin} onChange={(e) => set(i, { transitWeeksMin: Number(e.target.value) })} />
                <input style={input} inputMode="numeric" value={r.transitWeeksMax} onChange={(e) => set(i, { transitWeeksMax: Number(e.target.value) })} />
              </div>
            </Field>
          </Row>
          {rows.length > 1 && (
            <button style={{ ...mini, color: "var(--amber)" }} onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>Remove option</button>
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 10 }}>
        <button style={ghost} className="btn" onClick={() => setRows([...rows, { method: "CONTAINER", containerType: "SHARED", costCAD: "", transitWeeksMin: 8, transitWeeksMax: 12 }])}>+ Add option</button>
        <button className="btn btn-buy" disabled={busy} onClick={() => onSave(rows)}>Save shipping</button>
      </div>
    </Section>
  );
}

function ClearingEditor({
  current,
  busy,
  onSave,
}: {
  current: { costNGN: string; agentName: string; quoteRef: string | null; validUntil: string | null } | null;
  busy: boolean;
  onSave: (payload: { costNGN: string; agentName: string; quoteRef: string | null; validUntil: string | null }) => Promise<boolean>;
}) {
  const [costNGN, setCostNGN] = useState("");
  const [agentName, setAgentName] = useState("");
  const [quoteRef, setQuoteRef] = useState("");
  const [validUntil, setValidUntil] = useState("");

  return (
    <Section title="Clearing quote (Lagos, manual NGN)">
      {current ? (
        <p className="mono" style={{ fontSize: 11, color: "var(--steel)", marginBottom: 12 }}>
          Current: {fmtNGN(current.costNGN)} · {current.agentName}
          {current.validUntil ? ` · valid to ${new Date(current.validUntil).toLocaleDateString()}` : ""}
        </p>
      ) : (
        <p style={{ color: "var(--amber)", marginBottom: 12 }}>No clearing quote yet — required before publishing.</p>
      )}
      <Row>
        <Field><span style={label}>Clearing cost (NGN)</span><input style={input} inputMode="decimal" value={costNGN} onChange={(e) => setCostNGN(e.target.value)} /></Field>
        <Field><span style={label}>Agent name</span><input style={input} value={agentName} onChange={(e) => setAgentName(e.target.value)} /></Field>
      </Row>
      <Row>
        <Field><span style={label}>Quote ref (optional)</span><input style={input} value={quoteRef} onChange={(e) => setQuoteRef(e.target.value)} /></Field>
        <Field><span style={label}>Valid until (optional)</span><input style={input} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
      </Row>
      <button className="btn btn-buy" disabled={busy} onClick={async () => {
        const ok = await onSave({ costNGN, agentName, quoteRef: quoteRef || null, validUntil: validUntil || null });
        if (ok) { setCostNGN(""); setAgentName(""); setQuoteRef(""); setValidUntil(""); }
      }}>Save clearing quote</button>
    </Section>
  );
}

function HistoryEditor({
  current,
  busy,
  onSave,
}: {
  current: { hasClaims: boolean; summary: string | null; reportUrl: string | null } | null;
  busy: boolean;
  onSave: (payload: { hasClaims: boolean; summary: string | null; reportUrl: string | null }) => Promise<boolean>;
}) {
  const [hasClaims, setHasClaims] = useState(current?.hasClaims ?? false);
  const [summary, setSummary] = useState(current?.summary ?? "");
  const [reportUrl, setReportUrl] = useState(current?.reportUrl ?? "");

  return (
    <Section title="History report">
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={hasClaims} onChange={(e) => setHasClaims(e.target.checked)} />
        <span style={{ fontSize: 13, color: "var(--frost)" }}>Has accident/claim history</span>
      </label>
      <Field><span style={label}>Summary (optional)</span><textarea style={{ ...input, minHeight: 70, resize: "vertical" }} value={summary} onChange={(e) => setSummary(e.target.value)} /></Field>
      <Field><span style={label}>Report URL (optional)</span><input style={input} value={reportUrl} onChange={(e) => setReportUrl(e.target.value)} placeholder="https://…" /></Field>
      <button className="btn btn-buy" disabled={busy} onClick={() => onSave({ hasClaims, summary: summary || null, reportUrl: reportUrl || null })}>Save history</button>
    </Section>
  );
}

/* ----------------------------------------------------------------- bits */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--rule)", borderRadius: 14, padding: 16, marginBottom: 14, background: "rgba(255,255,255,.015)" }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--steel-dim)", marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>;
}

function Tag({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="mono" style={{ fontSize: 9, letterSpacing: 0.5, color: ok ? "var(--stamp)" : "var(--steel-dim)", border: `1px solid ${ok ? "var(--stamp)" : "var(--rule)"}`, borderRadius: 5, padding: "1px 6px" }}>
      {children}
    </span>
  );
}

function Alert({ tone, children }: { tone: "ok" | "warn"; children: React.ReactNode }) {
  const c = tone === "ok" ? "var(--stamp)" : "var(--amber)";
  return (
    <div style={{ border: `1px solid ${c}`, color: c, borderRadius: 9, padding: "9px 12px", marginBottom: 14, fontSize: 13 }}>
      {children}
    </div>
  );
}

const ghost: React.CSSProperties = {
  background: "transparent", border: "1px solid var(--rule)", color: "var(--steel)",
  borderRadius: 9, padding: "8px 13px", fontSize: 12, cursor: "pointer",
};
const primary: React.CSSProperties = {
  background: "var(--amber)", border: "1px solid var(--amber)", color: "#0B1413",
  borderRadius: 9, padding: "8px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer",
};
const mini: React.CSSProperties = {
  background: "transparent", border: "1px solid var(--rule)", color: "var(--steel)",
  borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer",
};
