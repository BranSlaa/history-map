'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import PageWrapper from '@/app/components/wrappers/PageWrapper';

const Profile: React.FC = () => {
	return (
		<PageWrapper>
			<h1 className="text-3xl font-bold mb-6 text-white text-center">
				User Profile
			</h1>

			{/* Main content */}
			<div className="col-span-12 px-4 pb-8">
				<div className="grid grid-cols-12 gap-4 max-w-7xl mx-auto">
					{/* User Info Card */}
					<div className="col-span-12 lg:col-span-4">
						<div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
							<h2 className="text-xl font-semibold mb-4 text-amber-500">
								User Information:
							</h2>
						</div>
					</div>
				</div>
			</div>
		</PageWrapper>
	);
};

export default Profile;
