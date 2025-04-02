import { CSSProperties } from 'react';

// Theme variables with TypeScript
export interface Theme {
	colors: {
		background: string;
		foreground: string;
		accent: string;
		accentDark: string;
		accentLight: string;
		success: string;
		warning: string;
		error: string;
		gray: {
			100: string;
			200: string;
			300: string;
			400: string;
			500: string;
		};
	};
	fonts: {
		body: string;
		heading: string;
	};
	spacing: {
		xs: string;
		sm: string;
		md: string;
		lg: string;
		xl: string;
		xxl: string;
	};
	borderRadius: {
		sm: string;
		md: string;
		lg: string;
		full: string;
	};
	shadows: {
		sm: string;
		md: string;
		lg: string;
	};
	breakpoints: {
		sm: string;
		md: string;
		lg: string;
		xl: string;
	};
	sidebar: {
		width: string;
	};
}

// Light theme
export const lightTheme: Theme = {
	colors: {
		background: '#ffffff',
		foreground: '#171717',
		accent: '#4E7DD6', // A more modern blue instead of magenta
		accentDark: '#3263C6',
		accentLight: '#EEF3FC',
		success: '#10B981',
		warning: '#F59E0B',
		error: '#EF4444',
		gray: {
			100: '#F9FAFB',
			200: '#F3F4F6',
			300: '#E5E7EB',
			400: '#D1D5DB',
			500: '#9CA3AF',
		},
	},
	fonts: {
		body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
		heading:
			"'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
	},
	spacing: {
		xs: '0.25rem',
		sm: '0.5rem',
		md: '1rem',
		lg: '1.5rem',
		xl: '2rem',
		xxl: '3rem',
	},
	borderRadius: {
		sm: '0.25rem',
		md: '0.5rem',
		lg: '0.75rem',
		full: '9999px',
	},
	shadows: {
		sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
		md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
		lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
	},
	breakpoints: {
		sm: '640px',
		md: '768px',
		lg: '1024px',
		xl: '1280px',
	},
	sidebar: {
		width: '16rem',
	},
};

// Using a more specific type for our styles that's compatible with React
export type StylesMap = Record<string, CSSProperties>;

// Component styles grouped by component
export interface ComponentStyles {
	[component: string]: StylesMap;
}

// Global styles as a function to access theme
export const createGlobalStyles = (theme: Theme): StylesMap => ({
	body: {
		color: theme.colors.foreground,
		backgroundColor: theme.colors.background,
		fontFamily: theme.fonts.body,
		WebkitFontSmoothing: 'antialiased',
		MozOsxFontSmoothing: 'grayscale',
		margin: 0,
		padding: 0,
	},
	paragraph: {
		fontSize: '1.125rem', // 18px
		lineHeight: 1.5,
		marginBottom: theme.spacing.md,
	},
	a: {
		color: 'inherit',
		textDecoration: 'none',
	},
	input: {
		color: theme.colors.foreground,
		backgroundColor: theme.colors.background,
		border: `1px solid ${theme.colors.gray[300]}`,
		borderRadius: theme.borderRadius.md,
		padding: theme.spacing.sm,
		fontSize: '1rem',
		width: '100%',
		transition: 'border-color 0.2s, box-shadow 0.2s',
		outline: 'none',
	},
	inputFocus: {
		borderColor: theme.colors.accent,
		boxShadow: `0 0 0 2px ${theme.colors.accentLight}`,
	},
	button: {
		color: 'white',
		backgroundColor: theme.colors.accent,
		border: 'none',
		borderRadius: theme.borderRadius.md,
		padding: `${theme.spacing.sm} ${theme.spacing.md}`,
		fontSize: '1rem',
		fontWeight: 500,
		cursor: 'pointer',
		transition: 'background-color 0.2s, transform 0.1s',
		outline: 'none',
	},
	buttonHover: {
		backgroundColor: theme.colors.accentDark,
	},
	buttonActive: {
		transform: 'translateY(1px)',
	},
});

// Component-specific styles
export const createComponentStyles = (theme: Theme): ComponentStyles => ({
	loadingIndicator: {
		container: {
			position: 'fixed',
			bottom: theme.spacing.lg,
			left: theme.spacing.md,
			backgroundColor: theme.colors.success,
			color: 'white',
			padding: `${theme.spacing.sm} ${theme.spacing.md}`,
			borderRadius: theme.borderRadius.md,
			boxShadow: theme.shadows.lg,
			zIndex: 1009,
			pointerEvents: 'none',
			display: 'flex',
			alignItems: 'center',
			gap: theme.spacing.sm,
		},
	},

	rangeContainer: {
		container: {
			display: 'flex',
			flexDirection: 'column',
			justifyContent: 'center',
			alignItems: 'center',
			gap: theme.spacing.sm,
			zIndex: 1001,
			width: 'calc(100% - 8rem)',
			position: 'absolute',
			top: theme.spacing.md,
			left: '4rem',
			right: '2rem',
			padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
			backgroundColor: theme.colors.background,
			border: `1px solid ${theme.colors.gray[300]}`,
			borderRadius: theme.borderRadius.md,
			boxShadow: theme.shadows.md,
		},
		range: {
			width: '100%',
			height: '1rem',
			appearance: 'none',
			backgroundColor: theme.colors.gray[200],
			borderRadius: theme.borderRadius.full,
			outline: 'none',
		},
		rangeThumb: {
			appearance: 'none',
			width: '1.25rem',
			height: '1.25rem',
			backgroundColor: theme.colors.accent,
			border: 'none',
			borderRadius: theme.borderRadius.full,
			cursor: 'pointer',
		},
		yearInput: {
			padding: theme.spacing.md,
			borderRadius: theme.borderRadius.md,
			border: `1px solid ${theme.colors.gray[300]}`,
			textAlign: 'center',
			fontWeight: 'bold',
			fontSize: '1.125rem',
		},
	},

	searchContainer: {
		container: {
			position: 'fixed',
			zIndex: 1001,
			top: '50%',
			left: '50%',
			transform: 'translate(-50%, -50%)',
			padding: `${theme.spacing.md} ${theme.spacing.xl}`,
			backgroundColor: theme.colors.background,
			border: `1px solid ${theme.colors.gray[300]}`,
			borderRadius: theme.borderRadius.md,
			display: 'flex',
			flexDirection: 'column',
			gap: theme.spacing.md,
			boxShadow: theme.shadows.lg,
			width: '28rem',
			maxWidth: '90vw',
		},
		label: {
			display: 'flex',
			flexDirection: 'column',
			gap: theme.spacing.sm,
			fontSize: '1rem',
			fontWeight: 500,
		},
		hidden: {
			display: 'none',
		},
	},

	mainApp: {
		window: {
			position: 'relative',
		},
		container: {
			position: 'relative',
			height: 'calc(100vh - 15rem)',
		},
	},

	informationSidebar: {
		container: {
			display: 'flex',
			flexDirection: 'column',
			justifyContent: 'space-between',
			gap: theme.spacing.md,
			backgroundColor: theme.colors.background,
			borderLeft: `1px solid ${theme.colors.gray[300]}`,
		},
	},

	eventPanel: {
		toggleButton: {
			position: 'fixed',
			zIndex: 1008,
			bottom: theme.spacing.lg,
			right: theme.spacing.sm,
			padding: theme.spacing.sm,
			borderRadius: theme.borderRadius.full,
			backgroundColor: theme.colors.accent,
			color: 'white',
			boxShadow: theme.shadows.md,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			width: '3rem',
			height: '3rem',
		},
		container: {
			position: 'fixed',
			zIndex: 1001,
			width: 'calc(100% - 4rem)',
			minHeight: '100px',
			maxHeight: '25vh',
			top: '50%',
			left: '2rem',
			right: '2rem',
			transform: 'translateY(-50%)',
			transition: 'transform 0.3s ease-in-out',
			backgroundColor: theme.colors.background,
			borderRadius: theme.borderRadius.md,
			padding: theme.spacing.md,
			display: 'none',
			boxShadow: theme.shadows.lg,
			border: `1px solid ${theme.colors.gray[300]}`,
		},
		titleBar: {
			display: 'flex',
			justifyContent: 'space-between',
			alignItems: 'center',
			marginBottom: theme.spacing.sm,
		},
		title: {
			fontSize: '1.25rem',
			fontWeight: 'bold',
		},
		eventList: {
			listStyleType: 'none',
			overflowY: 'auto',
			maxHeight: 'calc(25vh - 4rem)',
			padding: 0,
		},
		visible: {
			transform: 'translateY(-105%)',
			display: 'block',
		},
		eventListItem: {
			cursor: 'pointer',
			padding: theme.spacing.sm,
			transition: 'background-color 0.2s',
			borderRadius: theme.borderRadius.sm,
			marginBottom: theme.spacing.xs,
		},
		eventListItemHover: {
			backgroundColor: theme.colors.gray[100],
		},
		eventListItemFocus: {
			outline: `2px solid ${theme.colors.accent}`,
			outlineOffset: '-2px',
		},
	},

	informationPanel: {
		container: {
			height: '15rem',
			padding: `${theme.spacing.md} ${theme.spacing.xl}`,
			backgroundColor: theme.colors.background,
			overflowY: 'auto',
			borderTop: `1px solid ${theme.colors.gray[300]}`,
		},
		title: {
			fontSize: '1.5rem',
			fontWeight: 'bold',
			marginBottom: theme.spacing.sm,
			color: theme.colors.accent,
		},
		year: {
			marginBottom: theme.spacing.sm,
			fontSize: '1.125rem',
			color: theme.colors.gray[500],
		},
		description: {
			marginBottom: theme.spacing.sm,
			lineHeight: 1.6,
		},
		tagLine: {
			display: 'flex',
			gap: theme.spacing.sm,
			flexWrap: 'wrap',
		},
		tag: {
			backgroundColor: theme.colors.accentLight,
			color: theme.colors.accent,
			padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
			borderRadius: theme.borderRadius.full,
			fontSize: '0.875rem',
			fontWeight: 500,
		},
	},

	subjectFilterBar: {
		container: {
			display: 'flex',
			gap: theme.spacing.sm,
			padding: `${theme.spacing.sm} ${theme.spacing.md}`,
			backgroundColor: theme.colors.background,
			border: `1px solid ${theme.colors.gray[300]}`,
			borderRadius: theme.borderRadius.md,
			justifyContent: 'space-between',
			alignItems: 'center',
			position: 'absolute',
			bottom: theme.spacing.sm,
			left: theme.spacing.sm,
			right: theme.spacing.sm,
			zIndex: 1001,
			transition: 'transform 0.3s ease-in-out',
			boxShadow: theme.shadows.md,
		},
		hidden: {
			transform: 'translateX(calc(100% - 5rem))',
		},
		content: {
			display: 'flex',
			gap: theme.spacing.sm,
			overflowX: 'auto',
			padding: `${theme.spacing.xs} 0`,
			msOverflowStyle: 'none', // Hide scrollbar in IE and Edge
			scrollbarWidth: 'none', // Hide scrollbar in Firefox
		},
		contentHideScrollbar: {
			display: 'none', // Hide scrollbar in Chrome and Safari
		},
		label: {
			display: 'flex',
			gap: theme.spacing.sm,
			alignItems: 'center',
			whiteSpace: 'nowrap',
			fontSize: '0.875rem',
		},
		checkbox: {
			accentColor: theme.colors.accent,
		},
	},

	map: {
		container: {
			height: 'calc(100vh - 15rem) !important',
		},
	},
});

// Media query styles
export const createMediaQueryStyles = (theme: Theme): ComponentStyles => ({
	md: {
		mainAppWindow: {
			display: 'flex',
		},
		mainAppContainer: {
			maxWidth: `calc(100% - ${theme.sidebar.width})`,
			height: 'calc(100vh) !important',
		},
		searchContainer: {
			left: `calc(50% + 8rem)`,
		},
		informationSidebar: {
			margin: `${theme.spacing.sm} ${theme.spacing.md}`,
		},
		subjectFilterBarHidden: {
			transform: 'none',
			justifyContent: 'center',
			maxWidth: 'fit-content',
			margin: '0 auto',
		},
		eventPanelContainer: {
			position: 'relative',
			width: `${theme.sidebar.width} !important`,
			left: 0,
			top: theme.spacing.sm,
			right: 'unset',
			bottom: theme.spacing.sm,
			transform: 'unset',
			border: 'none',
			flex: `1 0 ${theme.sidebar.width}`,
			padding: 0,
			height: '50vh',
			maxHeight: 'calc(50vh - 8rem)',
			display: 'block',
			overflowY: 'auto',
		},
		eventPanelToggleButton: {
			display: 'none',
		},
		eventList: {
			height: 'calc(50vh - 1rem)',
		},
		informationPanelContainer: {
			border: 'none',
			padding: 0,
			display: 'block',
			height: '50vh',
			maxHeight: '50vh',
		},
		mapContainer: {
			height: '100vh !important',
		},
	},
});

// Helper function to apply styles based on current theme
export const applyTheme = (isDarkMode: boolean): Theme => {
	return isDarkMode ? darkTheme : lightTheme;
};
