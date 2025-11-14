"use client";

import React from "react";

interface RegistrationFormProps {
  title?: string;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ title = "Registration" }) => {
  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-6 pb-3 border-b">
        <h2 className="text-2xl font-bold text-black">{title}</h2>
      </div>

      {/* Body */}
      <div className="space-y-6">
        {/* Row: Firm / Developer Name + Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-black mb-1">
              Firm / Developer Name
            </label>
            <input
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter Firm / Developer Name"
            />
          </div>

          <div>
            <label className="block font-medium text-black mb-1">Type</label>
            <select className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">Select Type</option>
              <option>Developer</option>
              <option>Firm</option>
              <option>Individual</option>
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
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter PAN Number"
            />
          </div>

          <div>
            <label className="block font-medium text-black mb-1">
              Aadhar Number
            </label>
            <input
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
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter Telephone Number"
            />
          </div>

          <div>
            <label className="block font-medium text-black mb-1">
              Email ID
            </label>
            <input
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter Email ID"
            />
          </div>
        </div>

        {/* Full Width Address */}
        <div>
          <label className="block font-medium text-black mb-1">Address</label>
          <textarea
            className="border rounded-lg px-3 py-2 w-full h-20 text-black focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Enter Address"
          ></textarea>
        </div>

        {/* Row: Pincode + Mobile No */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-black mb-1">Pincode</label>
            <input
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter Pincode"
            />
          </div>

          <div>
            <label className="block font-medium text-black mb-1">Mobile Number</label>
            <input
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
              className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-black focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="text-center mt-4">
          <button className="bg-blue-600 text-white px-10 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition">
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegistrationForm;

