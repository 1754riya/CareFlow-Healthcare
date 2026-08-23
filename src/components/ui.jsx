import React, { forwardRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactCalendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 

// Utility for rendering modals
const Modal = ({ open, children }) => {
  if (!open) return null;
  return createPortal(children, document.body);
};

// Card Components
export const Card = forwardRef(({ className = '', children, ...props }, ref) => (
  <div ref={ref} className={`rounded-lg border bg-white shadow-sm ${className}`} {...props}>
    {children}
  </div>
));

export const CardHeader = ({ className = '', children, ...props }) => (
  <div className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className = '', children, ...props }) => (
  <h3 className={`text-2xl font-semibold leading-none tracking-tight ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ className = '', children, ...props }) => (
  <p className={`text-sm text-gray-500 ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent = ({ className = '', children, ...props }) => (
  <div className={`p-6 pt-0 ${className}`} {...props}>
    {children}
  </div>
);

// Button Component
export const Button = forwardRef(({ className = '', children, disabled, ...props }, ref) => (
  <button
    ref={ref}
    className={`px-4 py-2 rounded-md font-medium transition-colors 
      ${disabled ? 'bg-gray-200 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'} 
      ${className}`}
    disabled={disabled}
    {...props}
  >
    {children}
  </button>
));

// Avatar Component
export const Avatar = ({ className = '', children, ...props }) => (
  <div className={`relative rounded-full overflow-hidden ${className}`} {...props}>
    {children}
  </div>
);

// Badge Component
export const Badge = ({ variant = 'default', className = '', children, ...props }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    secondary: 'bg-gray-100 text-gray-800',
    outline: 'border border-gray-200 text-gray-800',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium 
        ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

// Separator Component
export const Separator = ({ className = '', ...props }) => (
  <div className={`h-[1px] w-full bg-gray-200 ${className}`} {...props} />
);

// Select Components
export const Select = ({ value, onValueChange, children }) => {
  return React.Children.map(children, (child) =>
    React.cloneElement(child, { value, onValueChange })
  );
};

export const SelectTrigger = ({ className = '', children, ...props }) => (
  <div
    className={`flex items-center justify-between rounded-md border p-2 
      text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const SelectValue = ({ placeholder, value }) => (
  <span className="text-gray-600">{value || placeholder}</span>
);

export const SelectContent = ({ className = '', children, ...props }) => (
  <div
    className={`absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 
      text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const SelectItem = ({ className = '', value, children, ...props }) => (
  <div
    className={`relative cursor-pointer select-none py-2 pl-3 pr-9 text-gray-900 
      hover:bg-gray-100 ${className}`}
    {...props}
  >
    {children}
  </div>
);

// Alert Dialog Components
export const AlertDialog = ({ open, onOpenChange, children }) => {
  return (
    <Modal open={open}>
      {React.cloneElement(children, { onOpenChange })}
    </Modal>
  );
};

export const AlertDialogTrigger = ({ asChild, children, onOpenChange }) => {
  const child = React.Children.only(children);
  return React.cloneElement(child, {
    onClick: (e) => {
      if (child.props.onClick) child.props.onClick(e);
      onOpenChange(true);
    },
  });
};

export const AlertDialogContent = ({ className = '', children, onOpenChange, ...props }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
    onClick={() => onOpenChange(false)}
    {...props}
  >
    <div
      className={`bg-white rounded-lg shadow-xl max-w-md w-full p-6 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

export const AlertDialogHeader = ({ className = '', children, ...props }) => (
  <div className={`mb-4 ${className}`} {...props}>
    {children}
  </div>
);

export const AlertDialogTitle = ({ className = '', children, ...props }) => (
  <h2 className={`text-lg font-semibold ${className}`} {...props}>
    {children}
  </h2>
);

export const AlertDialogDescription = ({ className = '', children, ...props }) => (
  <p className={`text-sm text-gray-500 ${className}`} {...props}>
    {children}
  </p>
);

export const AlertDialogFooter = ({ className = '', children, ...props }) => (
  <div className={`mt-4 flex justify-end space-x-2 ${className}`} {...props}>
    {children}
  </div>
);

export const AlertDialogAction = ({ className = '', children, onClick, ...props }) => (
  <Button className={`bg-blue-600 text-white ${className}`} onClick={onClick} {...props}>
    {children}
  </Button>
);

export const AlertDialogCancel = ({ className = '', children, onClick, ...props }) => (
  <Button className={`bg-gray-100 text-gray-800 hover:bg-gray-200 ${className}`} onClick={onClick} {...props}>
    {children}
  </Button>
);

Card.displayName = 'Card';
Button.displayName = 'Button';


export const Calendar = ({ className = '', ...props }) => {
  return (
    <div className={`calendar-container ${className}`}>
      <ReactCalendar
        {...props}
        tileDisabled={({ date }) => {
          // Disable past dates
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return date < today;
        }}
      />
    </div>
  );
};

