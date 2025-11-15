"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

interface RegistrationFormProps {
  title?: string;
}

type FormValues = {
  firmName: string;
  type: string;
  panNumber: string;
  aadharNumber: string;
  telephoneNumber: string;
  emailId: string;
  address: string;
  pincode: string;
  mobileNumber: string;

  panFile: FileList;
  aadharFile: FileList;
  photoFile: FileList;
  signatureFile: FileList;
};

const RegistrationForm: React.FC<RegistrationFormProps> = ({ title = "Registration" }) => {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<FormValues>();

  const onSubmit = (data: FormValues) => {
    console.log("Form Data:", data);

    // success message inside page
    alert("Registration Successful!");

    router.push("/");
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-6 pb-3 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <h2 className="text-2xl font-bold text-black">{title}</h2>

          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back to Home</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Row: Firm / Developer Name + Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Firm Name */}
          <div>
            <label className="block font-medium text-black mb-1">
              Firm / Developer Name <span className="text-red-500">*</span>
            </label>

            <input
              {...register("firmName", { required: "Firm / Developer Name is required" })}
              className="border rounded-lg px-3 py-2 w-full text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter Firm / Developer Name"
            />

            {errors.firmName && <p className="text-red-600 text-sm mt-1">{errors.firmName.message}</p>}
          </div>

          {/* Type */}
          <div>
            <label className="block font-medium text-black mb-1">
              Type <span className="text-red-500">*</span>
            </label>

            <select
              {...register("type", { required: "Type is required" })}
              className="border rounded-lg px-3 py-2 w-full text-black"
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

            {errors.type && <p className="text-red-600 text-sm mt-1">{errors.type.message}</p>}
          </div>
        </div>

        {/* Row: PAN Number + Aadhar Number */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PAN */}
          <div>
            <label className="block font-medium text-black mb-1">
              PAN Card Number <span className="text-red-500">*</span>
            </label>

            <input
              {...register("panNumber", { required: "PAN Number is required",
                pattern: {
                  value: /^[0-9]{12}$/,
                  message: "PAN Number must be 12 digits"
                }
               })}
              className="border rounded-lg px-3 py-2 w-full text-black"
              placeholder="Enter PAN Number"
              type="number"

            />
            {errors.panNumber && <p className="text-red-600 text-sm mt-1">{errors.panNumber.message}</p>}
          </div>

          {/* Aadhar */}
          <div>
            <label className="block font-medium text-black mb-1">
              Aadhar Number <span className="text-red-500">*</span>
            </label>

            <input
              {...register("aadharNumber", { required: "Aadhar Number is required" ,
                pattern: {
                  value: /^[0-9]{12}$/,
                  message: "Aadhar Number must be 12 digits"
                }})}
              className="border rounded-lg px-3 py-2 w-full text-black"
              placeholder="Enter Aadhar Number"
              type="number"
            />
            {errors.aadharNumber && <p className="text-red-600 text-sm mt-1">{errors.aadharNumber.message}</p>}
          </div>
        </div>

        {/* Row: PAN PDF + Aadhar PDF */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PAN File */}
          <div>
            <label className="block font-medium text-black mb-1">
              Upload PAN (PDF) <span className="text-red-500">*</span>
            </label>

            <input
              type="file"
              accept="application/pdf"
              {...register("panFile", { required: "PAN PDF is required" })}
              className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-black"
            />
            {errors.panFile && <p className="text-red-600 text-sm mt-1">{errors.panFile.message}</p>}
          </div>

          {/* Aadhar File */}
          <div>
            <label className="block font-medium text-black mb-1">
              Upload Aadhar (PDF) <span className="text-red-500">*</span>
            </label>

            <input
              type="file"
              accept="application/pdf"
              {...register("aadharFile", { required: "Aadhar PDF is required" })}
              className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-black"
            />
            {errors.aadharFile && <p className="text-red-600 text-sm mt-1">{errors.aadharFile.message}</p>}
          </div>
        </div>

        {/* Row: Telephone + Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Telephone */}
          <div>
            <label className="block font-medium text-black mb-1">
              Telephone Number <span className="text-red-500">*</span>
            </label>

            <input
              {...register("telephoneNumber", { required: "Telephone Number is required",
                pattern: {
                  value: /^[0-9]{10}$/,
                  message: "Telephone Number must be 10 digits"
                }
               },
                
              )}
              className="border rounded-lg px-3 py-2 w-full text-black"
              placeholder="Enter Telephone Number"
              type="number"
            />
            {errors.telephoneNumber && (
              <p className="text-red-600 text-sm mt-1">{errors.telephoneNumber.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block font-medium text-black mb-1">
              Email ID <span className="text-red-500">*</span>
            </label>

            <input
              type="email"
              {...register("emailId", {
                required: "Email is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Invalid Email Address"
                }
              })}
              className="border rounded-lg px-3 py-2 w-full text-black"
              placeholder="Enter Email ID"
            />
            {errors.emailId && <p className="text-red-600 text-sm mt-1">{errors.emailId.message}</p>}
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block font-medium text-black mb-1">
            Address <span className="text-red-500">*</span>
          </label>

          <textarea
            {...register("address", { required: "Address is required" })}
            className="border rounded-lg px-3 py-2 w-full h-20 text-black"
            placeholder="Enter Address"
          ></textarea>

          {errors.address && <p className="text-red-600 text-sm mt-1">{errors.address.message}</p>}
        </div>

        {/* Row: Pincode + Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pincode */}
          <div>
            <label className="block font-medium text-black mb-1">
              Pincode <span className="text-red-500">*</span>
            </label>

            <input
              {...register("pincode", { required: "Pincode is required" ,
                pattern: {
                  value: /^[0-9]{6}$/,
                  message: "Telephone Number must be 6 digits"
                }})}
              className="border rounded-lg px-3 py-2 w-full text-black"
              placeholder="Enter Pincode"
              type="number"
            />
            {errors.pincode && <p className="text-red-600 text-sm mt-1">{errors.pincode.message}</p>}
          </div>

          {/* Mobile Number */}
          <div>
            <label className="block font-medium text-black mb-1">
            Alternate Telephone Number <span className="text-red-500">*</span>
            </label>

            <input
              {...register("mobileNumber", {
                required: "Telephone Number is required",
                pattern: {
                  value: /^[0-9]{10}$/,
                  message: "Telephone Number must be 10 digits"
                }
              })}
              className="border rounded-lg px-3 py-2 w-full text-black"
              placeholder="Enter Mobile Number"
            />
            {errors.mobileNumber && <p className="text-red-600 text-sm mt-1">{errors.mobileNumber.message}</p>}
          </div>
        </div>

        {/* Row: Photo + Signature */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Photo */}
          <div>
            <label className="block font-medium text-black mb-1">
              Photo <span className="text-red-500">*</span>
            </label>

            <input
              type="file"
              accept="image/*"
              {...register("photoFile", { required: "Photo is required" })}
              className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-black"
            />
            {errors.photoFile && <p className="text-red-600 text-sm mt-1">{errors.photoFile.message}</p>}
          </div>

          {/* Signature */}
          <div>
            <label className="block font-medium text-black mb-1">
              Signature Image <span className="text-red-500">*</span>
            </label>

            <input
              type="file"
              accept="image/*"
              {...register("signatureFile", { required: "Signature image is required" })}
              className="border rounded-lg px-3 py-2 w-full bg-gray-50 text-black"
            />
            {errors.signatureFile && <p className="text-red-600 text-sm mt-1">{errors.signatureFile.message}</p>}
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
