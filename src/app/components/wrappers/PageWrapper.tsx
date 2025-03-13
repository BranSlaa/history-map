import React from 'react';

interface PageWrapperProps {
	children: React.ReactNode;
}

const PageWrapper: React.FC<PageWrapperProps> = ({ children }) => {
	return <div className="h-full pt-8 pb-16">{children}</div>;
};

export default PageWrapper;
