"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "../../../lib/getApiUrl";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const apiUrl = getApiUrl();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.replace("/admin/categories");
    } else {
      setChecking(false);
    }
  }, [router]);

  if (checking) return <div style={{ background: "#0f0f13", height: "100vh" }} />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error("Please enter a valid email address");
      }

      if (password.length < 3) {
        throw new Error("Password must be at least 3 characters");
      }

      const normalizedEmail = email.toLowerCase().trim();

      console.log("Attempting login with:", { email: normalizedEmail, apiUrl });

      const res = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      console.log("Response status:", res.status);

      if (!res.ok) {
        const data = await res.json();
        console.error("Login error response:", data);
        setError(data.error || "Login failed"); // Display error to the user
        throw new Error(data.error || "Login failed");
      }

      const data = await res.json();
      console.log("Login response:", { success: data.success, hasToken: !!data.token });

      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("email", email);
        console.log("Token saved successfully, redirecting to admin panel");
        router.push("/admin/categories");
      } else {
        throw new Error("No token received from server");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      console.error("Login error:", errorMessage, err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "radial-gradient(circle at top left, rgba(239,68,68,0.17), transparent 20%), radial-gradient(circle at bottom right, rgba(255,255,255,0.05), transparent 18%), #050507",
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{
        background: "linear-gradient(180deg, #14141a 0%, #0f0f13 100%)",
        padding: "40px",
        borderRadius: "18px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 30px 80px rgba(0,0,0,0.35)"
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
          <img src="/images/logo.svg" alt="Luxbae" width={120} height={36} style={{ objectFit: 'contain' }} />
        </div>
        <h1 style={{ color: "#f8fafc", marginBottom: "18px", fontFamily: "'Syne', sans-serif", fontSize: "28px", textAlign: "center" }}>
          Luxbae Admin
        </h1>
        <p style={{ color: '#9ca3af', textAlign: 'center', marginBottom: '26px', lineHeight: 1.6 }}>Manage brands, products, categories and banners with the Luxbae red & black dashboard.</p>

        {error && (
          <div style={{ background: "#ef444420", color: "#ef4444", padding: "12px", borderRadius: "8px", marginBottom: "20px", fontSize: "14px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", color: "#555570", fontSize: "12px", marginBottom: "6px" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                background: "#0f0f13",
                border: "1px solid #1e1e2e",
                borderRadius: "8px",
                color: "#e8e8f0",
                fontSize: "14px",
                outline: "none"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", color: "#555570", fontSize: "12px", marginBottom: "6px" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                background: "#0f0f13",
                border: "1px solid #1e1e2e",
                borderRadius: "8px",
                color: "#e8e8f0",
                fontSize: "14px",
                outline: "none"
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "14px",
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: "10px",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 10px 30px rgba(239,68,68,0.22)"
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}