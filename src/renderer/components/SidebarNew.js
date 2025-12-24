import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Users,
  Trophy,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Upload,
  UserCog,
  Eye,
  UsersRound,
  Plus,
  List,
  Home,
  Mountain
} from 'lucide-react';
import { cn } from '../design-system/utils/cn';

const SidebarNew = () => {
  const navigate = useNavigate();
  const { competitionId } = useParams();
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState({
    competitors: true,
    races: true,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const NavItem = ({ icon: Icon, label, path, onClick }) => {
    const active = isActive(path);

    return (
      <button
        onClick={onClick || (() => navigate(path))}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-md transition-all',
          active
            ? 'bg-primary-700 text-white shadow-sm'
            : 'text-neutral-700 hover:bg-neutral-100 hover:text-primary-700'
        )}
      >
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </button>
    );
  };

  const NavSection = ({ title, icon: Icon, children, sectionKey }) => {
    const expanded = expandedSections[sectionKey];

    return (
      <div className="mb-2">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 rounded-md transition-colors"
        >
          <div className="flex items-center gap-3">
            <Icon className="w-4 h-4" />
            <span>{title}</span>
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          )}
        </button>
        {expanded && (
          <div className="mt-1 ml-7 space-y-1">
            {children}
          </div>
        )}
      </div>
    );
  };

  if (!competitionId) {
    return (
      <div className="h-full bg-surface p-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-700 rounded-lg">
              <Mountain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Ski Race</h2>
              <p className="text-xs text-neutral-600">British Army</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <NavItem
            icon={Home}
            label="Select Competition"
            path="/"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-surface">
      {/* Logo/Brand */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-700 rounded-lg">
            <Mountain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Ski Race</h2>
            <p className="text-xs text-neutral-600">Competition Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-4">
        {/* Dashboard */}
        <NavItem
          icon={Home}
          label="Dashboard"
          path={`/competition/${competitionId}`}
        />

        <div className="h-px bg-border my-4" />

        {/* Competitors Section */}
        <NavSection
          title="Competitors"
          icon={Users}
          sectionKey="competitors"
        >
          <NavItem
            icon={UserCog}
            label="Manage"
            path={`/competition/${competitionId}/competitor/manage`}
          />
          <NavItem
            icon={Eye}
            label="View All"
            path={`/competition/${competitionId}/competitor/list`}
          />
          <NavItem
            icon={UserPlus}
            label="Register"
            path={`/competition/${competitionId}/competitor/new`}
          />
          <NavItem
            icon={Upload}
            label="Bulk Upload"
            path={`/competition/${competitionId}/competitor/bulk`}
          />
          <NavItem
            icon={UsersRound}
            label="Teams"
            path={`/competition/${competitionId}/team/list`}
          />
        </NavSection>

        {/* Races Section */}
        <NavSection
          title="Races"
          icon={Trophy}
          sectionKey="races"
        >
          <NavItem
            icon={List}
            label="View Races"
            path={`/competition/${competitionId}/race`}
          />
          <NavItem
            icon={Plus}
            label="New Race"
            path={`/competition/${competitionId}/race/new`}
          />
        </NavSection>
      </nav>
    </div>
  );
};

export default SidebarNew;
