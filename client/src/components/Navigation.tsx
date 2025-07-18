import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";

interface NavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Navigation({ isOpen, onClose }: NavigationProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/admin",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
        </svg>
      )
    },
    {
      name: "Customer Management",
      href: "/admin/customers",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      name: "Staff Management",
      href: "/admin/staff",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      )
    },
    {
      name: "Team Management",
      href: "/admin/teams",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      name: "Reports",
      href: "/admin/reports",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      name: "Invoices",
      href: "/admin/invoices",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      name: "Settings",
      href: "/admin/settings",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 0V4m0 16v-4m8-4h-4m-8 0H4m13.66-6.34l-2.83 2.83M6.34 17.66l2.83-2.83m0-8.49l-2.83 2.83M17.66 17.66l-2.83-2.83" />
        </svg>
      )
    }
  ];

  const isActive = (href: string) => {
    if (href === "/admin") {
      return location === "/admin";
    }
    return location.startsWith(href);
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div 
        className={`fixed inset-0 bg-gray-600 transition-opacity duration-300 ease-in-out z-40 lg:hidden ${
          isOpen ? 'bg-opacity-75 pointer-events-auto' : 'bg-opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Navigation sidebar */}
      <div className={`
        fixed top-0 right-0 z-50 h-screen w-80 max-w-[85vw] bg-white shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : 'translate-x-full'} lg:fixed lg:left-0 lg:translate-x-0 lg:z-auto lg:w-64 lg:h-screen
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 border-b border-gray-200 h-[84px]">
          <div className="flex items-center h-full pt-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
              <svg className="w-8 h-8" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
                <circle cx="75" cy="75" r="75" fill="#592c81"/>
                <path d="M51.88,124.89l11.26-52.91s-14.98-6.86-14.98-24.18,14.92-27.05,27-27.05,27.06,9.51,27.06,27.05-14.99,24.19-14.99,24.19l13.77,52.9h-49.12Z" fill="#fff" stroke="#999" strokeMiterlimit="10" strokeWidth="0.5"/>
              </svg>
            </div>
            <span className="ml-3 text-lg font-semibold text-gray-900 leading-none">MyHome CleanTeam</span>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          <div className="space-y-3">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`
                  group flex items-center px-3 py-3 text-sm font-medium rounded-md transition-colors
                  ${isActive(item.href)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <span className={`mr-3 ${isActive(item.href) ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'}`}>
                  {item.icon}
                </span>
                {item.name}
              </Link>
            ))}
          </div>
        </nav>

        {/* Bottom section with user info and logout */}
        <div className="border-t border-gray-200 p-4 space-y-3 mt-auto">
          {/* User info */}
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-medium">
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </span>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={logout}
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </>
  );
}
