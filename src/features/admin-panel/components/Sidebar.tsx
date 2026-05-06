import type { Page } from "../types";
import { IBell, ICal, IGrid, ILogout, ISciss, IUsers } from "../icons";

interface SidebarProps {
  page: Page;
  onChangePage: (page: Page) => void;
  onLogout: () => void;
  adminName: string;
  adminAvatar?: string | null;
}

const navItems: Array<{ id: Page; label: string; icon: JSX.Element }> = [
  { id: "dashboard", label: "Bosh sahifa", icon: <IGrid /> },
  { id: "barbers", label: "Sartaroshlar", icon: <IUsers /> },
  { id: "bookings", label: "Bronlar", icon: <ICal /> },
  { id: "support", label: "Support sozlamalari", icon: <IBell /> },
];

export function Sidebar({ page, onChangePage, onLogout, adminName, adminAvatar }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sb-top">
        <div className="sb-brand">
          <div className="sb-logo">
            <ISciss />
          </div>
          <div>
            <div className="sb-name">Sharp Cuts</div>
            <div className="sb-tag">Boshqaruv paneli</div>
          </div>
        </div>
        <nav className="sb-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => onChangePage(item.id)}
            >
              <span className="nav-ico">{item.icon}</span>
              <span>{item.label}</span>
              {page === item.id && <span className="nav-pip" />}
            </button>
          ))}
        </nav>
      </div>
      <div className="sb-foot">
        <div className="sb-admin">
          {adminAvatar ? <img src={adminAvatar} alt={adminName} className="sb-av sb-av-img" /> : <div className="sb-av">{adminName.trim().charAt(0).toUpperCase() || "A"}</div>}
          <div>
            <div className="sb-aname">{adminName}</div>
            <div className="sb-arole">Bosh administrator</div>
          </div>
        </div>
        <button className="logout-btn" onClick={onLogout}>
          <ILogout /> Hisobdan chiqish
        </button>
      </div>
    </aside>
  );
}
