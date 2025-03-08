'use client';

import React, { ButtonHTMLAttributes } from 'react';
import { classNames } from '@/utils/styleUtils';

interface StyledButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: 'primary' | 'secondary' | 'outlined';
	size?: 'sm' | 'md' | 'lg';
	fullWidth?: boolean;
}

export const StyledButton: React.FC<StyledButtonProps> = ({
	children,
	variant = 'primary',
	size = 'md',
	fullWidth = false,
	disabled = false,
	className = '',
	...props
}) => {
	// Base styles that apply to all variants
	const baseStyles =
		'rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50';

	// Variant-specific styles
	const variantStyles = {
		primary:
			'bg-amber-600 hover:bg-amber-700 text-white border border-transparent',
		secondary:
			'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-transparent dark:bg-stone-700 dark:hover:bg-stone-600 dark:text-amber-200',
		outlined:
			'bg-transparent hover:bg-amber-50 text-amber-600 border border-amber-600 dark:text-amber-400 dark:border-amber-400 dark:hover:bg-stone-800',
	};

	// Size-specific styles
	const sizeStyles = {
		sm: 'px-2 py-1 text-sm',
		md: 'px-4 py-2 text-base',
		lg: 'px-6 py-3 text-lg',
	};

	// Disabled styles
	const disabledStyles = disabled
		? 'opacity-50 cursor-not-allowed'
		: 'cursor-pointer';

	// Width styles
	const widthStyles = fullWidth ? 'w-full' : '';

	// Combine all styles
	const buttonStyles = classNames(
		baseStyles,
		variantStyles[variant],
		sizeStyles[size],
		disabledStyles,
		widthStyles,
		className,
	);

	return (
		<button className={buttonStyles} disabled={disabled} {...props}>
			{children}
		</button>
	);
};
