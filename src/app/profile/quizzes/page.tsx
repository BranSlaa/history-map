'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiMap } from 'react-icons/fi';
import PageWrapper from '@/app/components/wrappers/PageWrapper';

const ProfileQuizzes: React.FC = () => {
	return (
		<PageWrapper>
			<div className="flex justify-between items-center mb-6">
				<div className="flex items-center gap-2">
					<Link
						href="/profile"
						className="text-gray-600 hover:text-blue-500"
					>
						<FiArrowLeft size={20} />
					</Link>
					<h1 className="text-2xl font-bold">Your Quizzes</h1>
				</div>
				<div className="flex gap-2">
					<Link
						href="/"
						className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
					>
						<FiMap className="mr-2" /> Back to Map
					</Link>
				</div>
			</div>
		</PageWrapper>
	);
};

export default ProfileQuizzes;
