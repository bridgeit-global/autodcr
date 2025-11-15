"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface RegistrationFormProps {
  title?: string;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ title = "Registration" }) => {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    firmName: "",
    type: "",
    panNumber: "",
    aadharNumber: "",
    panFile: null as File | null,
    aadharFile: null as File | null,
    telephoneNumber: "",
    emailId: "",
    address: "",
    pincode: "",
    mobileNumber: "",
    photoFile: null as File | null,
    signatureFile: null as File | null,
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (field: string, file: File | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: file
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if all fields are filled
    const requiredFields = [
      'firmName',
      'type',
      'panNumber',
      'aadharNumber',
      'telephoneNumber',
      'emailId',
      'address',
      'pincode',
      'mobileNumber',
    ];

    const requiredFiles = [
      'panFile',
      'aadharFile',
      'photoFile',
      'signatureFile',
    ];

    // Check text/select fields
    const hasEmptyTextFields = requiredFields.some(field => !formData[field as keyof typeof formData]);

    // Check file fields
    const hasEmptyFileFields = requiredFiles.some(field => !formData[field as keyof typeof formData]);

    if (hasEmptyTextFields || hasEmptyFileFields) {
      alert('Please fill all the necessary fields');
      return;
    }

    // If all fields are filled, proceed with submission
    console.log('Form submitted:', formData);
    
    // Show submission complete alert
    alert('Submission complete');
    
    // Navigate back to landing page
    router.push('/');
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-6 pb-3 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <h2 className="text-2xl font-bold text-black">{title}</h2>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors self-start sm:self-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back to Home</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Row: Firm / Developer Name + Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-black mb-1">
              Firm / Developer Name
            </label>
            <input
              value={formData.firmName}
              onChange={(e) => handleInputChange("firmName", e.target.value)}
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter Firm / Developer Name"
            />
          </div>

          <div>
            <label className="block font-medium text-black mb-1">Type</label>
            <select 
              value={formData.type}
              onChange={(e) => handleInputChange("type", e.target.value)}
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Select</option>
              <option>Single Owner Proprietary Firm</option>
              <option>Partnership Firm</option>
              <option>Private Limited Firm</option>
              <option>Public Limited Firm</option>
              <option>Government Semi Government Firms</option>
              <option>Trust</option>
              <option>Joint Venture (JV)</option>
              <option>Limited Liability Partnership LLP</option>
              <option>Association of Persons AOP</option>
              <option>Special Purpose Vehicle SPV</option>
              <option>Joint Development Agreement JDA</option>
            </select>
          </div>
        </div>

        {/* Row: PAN No + Aadhar No */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-black mb-1">
              PAN Card Number
            </label>
            <input
              value={formData.panNumber}
              onChange={(e) => handleInputChange("panNumber", e.target.value)}
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter PAN Number"
            />
          </div>

          <div>
            <label className="block font-medium text-black mb-1">
              Aadhar Number
            </label>
            <input
              value={formData.aadharNumber}
              onChange={(e) => handleInputChange("aadharNumber", e.target.value)}
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter Aadhar Number"
            />
          </div>
        </div>

        {/* Row: PAN PDF + Aadhar PDF */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-black mb-1">
              Upload PAN (PDF)
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => handleFileChange("panFile", e.target.files?.[0] || null)}
              className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-black focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-black mb-1">
              Upload Aadhar (PDF)
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => handleFileChange("aadharFile", e.target.files?.[0] || null)}
              className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-black focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Row: Telephone + Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-black mb-1">
              Telephone Number
            </label>
            <input
              value={formData.telephoneNumber}
              onChange={(e) => handleInputChange("telephoneNumber", e.target.value)}
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter Telephone Number"
            />
          </div>

          <div>
            <label className="block font-medium text-black mb-1">
              Email ID
            </label>
            <input
              type="email"
              value={formData.emailId}
              onChange={(e) => handleInputChange("emailId", e.target.value)}
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter Email ID"
            />
          </div>
        </div>

        {/* Full Width Address */}
        <div>
          <label className="block font-medium text-black mb-1">Address</label>
          <textarea
            value={formData.address}
            onChange={(e) => handleInputChange("address", e.target.value)}
            className="border rounded-lg px-3 py-2 w-full h-20 text-black focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Enter Address"
          ></textarea>
        </div>

        {/* Row: Pincode + Mobile No */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-black mb-1">Pincode</label>
            <input
              value={formData.pincode}
              onChange={(e) => handleInputChange("pincode", e.target.value)}
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter Pincode"
            />
          </div>

          <div>
            <label className="block font-medium text-black mb-1">Mobile Number</label>
            <input
              value={formData.mobileNumber}
              onChange={(e) => handleInputChange("mobileNumber", e.target.value)}
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter Mobile Number"
            />
          </div>
        </div>

        {/* Row: Photo + Signature */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-black mb-1">Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange("photoFile", e.target.files?.[0] || null)}
              className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-black focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-black mb-1">
              Signature Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange("signatureFile", e.target.files?.[0] || null)}
              className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-black focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="text-center mt-4">
          <button 
            type="submit"
            className="bg-blue-600 text-white px-10 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegistrationForm;

