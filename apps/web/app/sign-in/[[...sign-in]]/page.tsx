import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div style={{ display: "grid", placeItems: "center", padding: "56px 16px" }}>
      <SignIn />
    </div>
  );
}
