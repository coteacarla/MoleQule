import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  ...props
}) => {
  const baseClasses = 'font-semibold py-3 px-4 rounded-lg transition-colors disabled:cursor-not-allowed';
  const variantClasses = {
    primary: 'bg-primary-500 hover:bg-primary-600 text-white disabled:bg-gray-600',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-white',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};