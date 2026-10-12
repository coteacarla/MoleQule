
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { UserMenu } from "../components/Sidebar/UserMenu";
import clsx from "clsx";
import { useEffect } from "react";

function MainLayout() {
  const location = useLocation();

  // Scroll to top when route changes
  useEffect(() => {
    window.scrollTo(0, 0);
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTop = 0;
    }
  }, [location.pathname]);
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "block w-full text-left px-4 py-3 rounded-lg transition-colors font-medium",
      isActive
        ? "bg-primary-500 text-white font-semibold shadow-lg"
        : "text-gray-300 hover:bg-gray-700 hover:text-white"
    );

  const rootClasses = "flex flex-col h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden";
  const navClasses = "bg-gray-800/90 backdrop-blur-sm border-b border-gray-700/50 shadow-xl z-50 relative";
  const footerClasses = "bg-gray-800/90 backdrop-blur-sm border-t border-gray-700/50 py-3";

  return (
    <div className={rootClasses}>
      {/* Top Navigation Bar */}
      <div className={navClasses}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
           {/* Logo and Title */}
            <div className="flex-shrink-0 w-36 flex items-center gap-2">
              <img src="/Logo-green.svg" alt="MoleQule Logo" className="w-12 h-12" />
              <h1 className="text-lg font-bold leading-snug text-green-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
                MoleQule
              </h1>
            </div>

            {/* Navigation */}
            <nav className="flex items-center space-x-4 ml-2 flex-1">
              <div className="flex items-center space-x-2">
                <NavLink to="/molecule" className={({ isActive }) => 
                  clsx(
                    "px-4 py-2 rounded-lg transition-colors font-medium",
                    isActive
                      ? "bg-primary-500 text-white font-semibold shadow-lg"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  )
                }>
                  Build Molecule
                </NavLink>
                <NavLink to="/run" className={({ isActive }) => 
                  clsx(
                    "px-4 py-2 rounded-lg transition-colors font-medium",
                    isActive
                      ? "bg-primary-500 text-white font-semibold shadow-lg"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  )
                }>
                  Run & Results
                </NavLink>
              </div>

            </nav>

            {/* User Menu */}
            <div className="flex items-center ml-auto">
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="max-w-7xl mx-auto p-8">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <div className={footerClasses}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-xs text-gray-500 flex items-center justify-between">
            <p>VQE Pipeline</p>
            <p>Qiskit Fall Fest 2025</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainLayout;