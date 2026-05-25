"use client";

import { useState, useRef } from "react";

interface SignerCertificateInfo {
  commonName: string;
  organization: string;
  state: string;
  postalCode: string;
  serialNumber: string;
  issuer: string;
  validFrom: string;
  validTo: string;
}

interface SignerDetail {
  name: string;
  certificate: SignerCertificateInfo | null;
}

interface SignatureInfo {
  isSigned: boolean;
  signatureCount: number;
  signers: SignerDetail[];
}

type CheckResult = SignatureInfo | { error: string } | null;

export default function CheckSignaturePage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CheckResult>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleCheck() {
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/check-pdf-signature", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error || "Something went wrong" });
      } else {
        setResult(data as SignatureInfo);
      }
    } catch {
      setResult({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">
          PDF Signature Checker
        </h1>
        <p className="text-sm text-gray-500 text-center mb-8">
          Upload a PDF to check digital signature details
        </p>

        <div className="space-y-5">
          {/* File Input */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
              }}
              className="hidden"
              id="pdf-upload"
            />
            <label htmlFor="pdf-upload" className="cursor-pointer block">
              <div className="text-4xl mb-2">📄</div>
              {file ? (
                <p className="text-sm text-gray-700 font-medium truncate">
                  {file.name}
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  Click to select a PDF file
                </p>
              )}
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCheck}
              disabled={!file || loading}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Checking..." : "Check Signature"}
            </button>
            {(file || result) && (
              <button
                onClick={handleReset}
                className="px-4 py-3 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {/* Error */}
          {result && "error" in result && (
            <div className="rounded-xl p-4 text-center font-medium bg-red-50 text-red-700 border border-red-200">
              {result.error}
            </div>
          )}

          {/* Not Signed */}
          {result && !("error" in result) && !result.isSigned && (
            <div className="rounded-xl p-4 text-center font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
              This PDF is NOT Digitally Signed
            </div>
          )}

          {/* Signed — Full Details */}
          {result && !("error" in result) && result.isSigned && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 text-center font-medium bg-green-50 text-green-700 border border-green-200">
                This PDF is Digitally Signed ({result.signatureCount}{" "}
                {result.signatureCount === 1 ? "signature" : "signatures"})
              </div>

              {result.signers.map((signer, idx) => (
                <SignerCard
                  key={idx}
                  signer={signer}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SignerCard({
  signer,
  formatDate,
}: {
  signer: SignerDetail;
  formatDate: (iso: string) => string;
}) {
  const [pan, setPan] = useState("");
  const [verifyResult, setVerifyResult] = useState<"match" | "no-match" | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function handleVerifyPan() {
    if (!pan.trim() || !signer.certificate?.serialNumber) return;
    setVerifying(true);
    setVerifyResult(null);

    try {
      const res = await fetch("/api/verify-pan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pan: pan.trim(),
          certSerialNumber: signer.certificate.serialNumber,
        }),
      });
      const data = await res.json();
      setVerifyResult(data.isMatch ? "match" : "no-match");
    } catch {
      setVerifyResult("no-match");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex items-center gap-2">
        <span className="text-green-600 font-bold">✓</span>
        <span className="font-semibold text-gray-800">{signer.name}</span>
      </div>

      {signer.certificate && (
        <div className="px-4 py-3 space-y-2 text-sm">
          <InfoRow label="Name (CN)" value={signer.certificate.commonName} />
          <InfoRow label="Organization" value={signer.certificate.organization} />
          <InfoRow label="State" value={signer.certificate.state} />
          <InfoRow label="Postal Code" value={signer.certificate.postalCode} />
          <InfoRow
            label="Serial No. (PAN Hash)"
            value={signer.certificate.serialNumber}
            mono
          />
          <InfoRow label="Issued By" value={signer.certificate.issuer} />
          <InfoRow
            label="Valid"
            value={`${formatDate(signer.certificate.validFrom)} — ${formatDate(signer.certificate.validTo)}`}
          />

          {/* PAN Verification */}
          {signer.certificate.serialNumber && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <label className="text-xs text-gray-500 block mb-1.5">
                Verify PAN Number
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter PAN (e.g. ABCDE1234F)"
                  value={pan}
                  onChange={(e) => {
                    setPan(e.target.value.toUpperCase());
                    setVerifyResult(null);
                  }}
                  maxLength={10}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={handleVerifyPan}
                  disabled={pan.length !== 10 || verifying}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {verifying ? "..." : "Verify"}
                </button>
              </div>

              {verifyResult === "match" && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
                  ✅ PAN Matched — This DSC belongs to PAN {pan}
                </div>
              )}
              {verifyResult === "no-match" && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                  ❌ PAN Does NOT Match — This DSC was not issued to PAN {pan}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!signer.certificate && (
        <div className="px-4 py-3 text-sm text-gray-500 italic">
          Certificate details could not be extracted
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-gray-500 text-xs">{label}</span>
      <span
        className={`text-gray-800 font-medium break-all ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
