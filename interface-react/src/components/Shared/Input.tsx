import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, id, ...props }) => {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm mb-1 text-gray-300">
          {label}
        </label>
      )}
      <input
        id={id}
        className="input-field w-full"
        {...props}
      />
    </div>
  );
};