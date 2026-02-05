'use client';

import { useState, useEffect } from 'react';

export default function DSCSigner() {
  const [status, setStatus] = useState<any>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [selectedCert, setSelectedCert] = useState({ certIndex: 0, slotIndex: 0 });
  const [pin, setPin] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
    listCertificates();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/dsc/status');
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (error) {
      console.error('Status check failed:', error);
      setError('Failed to check DSC status');
    }
  };

  const listCertificates = async () => {
    try {
      const res = await fetch('/api/dsc/certificates');
      const data = await res.json();
      if (data.success && data.certificates.length > 0) {
        setCertificates(data.certificates);
        setSelectedCert({
          certIndex: data.certificates[0].certIndex,
          slotIndex: data.certificates[0].slotIndex,
        });
        setError(null);
      } else if (!data.success) {
        setError(data.error || 'Failed to list certificates');
      }
    } catch (error) {
      console.error('Failed to list certificates:', error);
      setError('Failed to list certificates');
    }
  };

  const handleSign = async () => {
    if (!file) {
      setError('Please select a PDF file');
      return;
    }

    if (!status?.connected) {
      setError('DSC token is not connected. Please connect your DSC token.');
      return;
    }

    setLoading(true);
    setError(null);
    setSignedPdfUrl(null);

    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('pin', pin);
      formData.append('certificateIndex', selectedCert.certIndex.toString());
      formData.append('slotIndex', selectedCert.slotIndex.toString());

      const res = await fetch('/api/dsc/sign-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setSignedPdfUrl(data.signedUrl);
        setFile(null);
        setPin('');
      } else {
        setError(data.error || data.details || 'Signing failed');
      }
    } catch (error: any) {
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h2>DSC PDF Signer</h2>

      <div style={{
        padding: '15px',
        marginBottom: '20px',
        borderRadius: '5px',
        backgroundColor: status?.connected ? '#d4edda' : '#f8d7da',
        border: `1px solid ${status?.connected ? '#c3e6cb' : '#f5c6cb'}`,
      }}>
        <h3>DSC Status</h3>
        {status ? (
          <div>
            <p><strong>Connected:</strong> {status.connected ? '✅ Yes' : '❌ No'}</p>
            <p><strong>Message:</strong> {status.message}</p>
            {status.subject && <p><strong>Certificate:</strong> {status.subject}</p>}
          </div>
        ) : (
          <p>Checking status...</p>
        )}
      </div>

      {error && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          borderRadius: '5px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          color: '#721c24',
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {certificates.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Select Certificate</h3>
          <select
            value={`${selectedCert.slotIndex}-${selectedCert.certIndex}`}
            onChange={(e) => {
              const [slotIdx, certIdx] = e.target.value.split('-').map(Number);
              setSelectedCert({ certIndex: certIdx, slotIndex: slotIdx });
            }}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              borderRadius: '5px',
              border: '1px solid #ddd',
            }}
          >
            {certificates.map((cert, idx) => (
              <option key={idx} value={`${cert.slotIndex}-${cert.certIndex}`}>
                {cert.tokenLabel} - {cert.label} (Slot {cert.slotIndex}, Cert {cert.certIndex})
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          DSC PIN:
        </label>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Enter DSC PIN"
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            borderRadius: '5px',
            border: '1px solid #ddd',
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Select PDF File:
        </label>
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
          }}
        />
        {file && (
          <p style={{ marginTop: '5px', color: '#666' }}>
            Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </p>
        )}
      </div>

      <button
        onClick={handleSign}
        disabled={loading || !file || !status?.connected}
        style={{
          width: '100%',
          padding: '15px',
          fontSize: '16px',
          fontWeight: 'bold',
          backgroundColor: (loading || !file || !status?.connected) ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: (loading || !file || !status?.connected) ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Signing...' : 'Sign PDF'}
      </button>

      {signedPdfUrl && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          borderRadius: '5px',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
        }}>
          <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>✅ PDF signed successfully!</p>
          <a
            href={signedPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '5px',
            }}
          >
            Download Signed PDF
          </a>
        </div>
      )}
    </div>
  );
}

