import React from 'react';

export function InputField({ label, type = 'text', ...props }) {
  return (
    <div className="mb-4">
      <label className="block text-gray-700 mb-2">{label}</label>
      <input
        type={type}
        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:outline-none focus:border-green-500"
        {...props}
      />
    </div>
  );
}