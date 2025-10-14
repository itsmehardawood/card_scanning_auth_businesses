"use client";
import React from "react";

const HomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-700 to-black p-4 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Card Detection App</h1>
        <p className="text-gray-600 mb-6">
          This app requires specific URL parameters to function.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-blue-800 mb-2">Expected URL Format:</h2>
          <code className="text-sm text-blue-600 break-all">
            /businessname/scanid
          </code>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-2">Example:</h3>
          <code className="text-sm text-gray-600 break-all">
            /XYZ/eba42365
          </code>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          Please use the correct URL format to access the card detection functionality.
        </p>
      </div>
    </div>
  );
};

export default HomePage;
