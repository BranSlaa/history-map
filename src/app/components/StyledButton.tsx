'use client';

import React, { ButtonHTMLAttributes, CSSProperties, useState } from 'react';
import { useThemeStyles, mergeStyles } from '@/utils/styleUtils';

interface StyledButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: 'primary' | 'secondary' | 'outlined';
	size?: 'sm' | 'md' | 'lg';
	fullWidth?: boolean;
	customStyle?: CSSProperties;
}

export const StyledButton: React.FC<StyledButtonProps> = ({
	children,
	variant = 'primary',
	size = 'md',
	fullWidth = false,
	disabled = false,
	customStyle,
	...props
}) => {
	const [isHovered, setIsHovered] = useState(false);
	const [isActive, setIsActive] = useState(false);
	const { theme, globalStyles } = useThemeStyles(false); // Default to light theme

	// Size-based styles
	const sizeStyles: Record<string, CSSProperties> = {
		sm: {
			padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
			fontSize: '0.875rem',
		},
		md: {
			padding: `${theme.spacing.sm} ${theme.spacing.md}`,
			fontSize: '1rem',
		},
		lg: {
			padding: `${theme.spacing.md} ${theme.spacing.lg}`,
			fontSize: '1.125rem',
		},
	};

	// Variant-based styles
	const variantStyles: Record<string, CSSProperties> = {
		primary: {
			backgroundColor: theme.colors.accent,
			color: 'white',
			border: 'none',
		},
		secondary: {
			backgroundColor: theme.colors.gray[200],
			color: theme.colors.foreground,
			border: 'none',
		},
		outlined: {
			backgroundColor: 'transparent',
			color: theme.colors.accent,
			border: `1px solid ${theme.colors.accent}`,
		},
	};

	// State-based styles
	const stateStyles: CSSProperties = {
		...(isHovered && !disabled ? globalStyles.buttonHover : {}),
		...(isActive && !disabled ? globalStyles.buttonActive : {}),
		...(disabled
			? {
					opacity: 0.6,
					cursor: 'not-allowed',
				}
			: {}),
		...(fullWidth ? { width: '100%' } : {}),
	};

	// Combine all styles
	const buttonStyle = mergeStyles(
		globalStyles.button,
		variantStyles[variant],
		sizeStyles[size],
		stateStyles,
		customStyle,
	);

	return (
		<button
			style={buttonStyle}
			disabled={disabled}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => {
				setIsHovered(false);
				setIsActive(false);
			}}
			onMouseDown={() => setIsActive(true)}
			onMouseUp={() => setIsActive(false)}
			{...props}
		>
			{children}
		</button>
	);
};
