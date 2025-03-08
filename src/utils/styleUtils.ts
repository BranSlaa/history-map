import { useMemo } from 'react';
import { Theme, applyTheme } from '../app/styles';

/**
 * Hook to access theme based on current dark/light mode
 * @param isDarkMode Boolean to determine if dark mode is active
 * @returns Object containing theme
 */
export const useThemeStyles = (isDarkMode: boolean) => {
	const theme = useMemo(() => applyTheme(isDarkMode), [isDarkMode]);

	return {
		theme,
	};
};

/**
 * Utility function to combine Tailwind classes
 * @param classes Array of class strings or conditionals
 * @returns Combined class string
 */
export const classNames = (...classes: (string | boolean | undefined)[]) => {
	return classes.filter(Boolean).join(' ');
};

/**
 * Merges styles from different sources
 * @param baseStyles Base styles
 * @param additionalStyles Additional styles to merge
 * @returns Merged styles
 */
export const mergeStyles = (
	baseStyles: Record<string, any>, 
	additionalStyles: Record<string, any> = {}
): Record<string, any> => {
	return { ...baseStyles, ...additionalStyles };
};

/**
 * Gets a component style from the theme
 * @param componentStyles Record of component styles
 * @param componentName Name of the component
 * @param styleName Name of the style
 * @returns The component style
 */
export const getComponentStyle = (
	componentStyles: Record<string, any>,
	componentName: string,
	styleName: string
): Record<string, any> => {
	if (!componentStyles || !componentStyles[componentName]) {
		return {};
	}
	
	return componentStyles[componentName][styleName] || {};
};
