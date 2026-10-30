const paths = {
  car: <><path d="M5 16.5h14l-1.2-5.2a2 2 0 0 0-2-1.55H8.2a2 2 0 0 0-2 1.55L5 16.5Z" /><path d="M4 16.5h16v3H4zM7 19.5v1.5M17 19.5v1.5M7.5 14h.01M16.5 14h.01" /><path d="m7 9.75 1.1-3h7.8l1.1 3" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7 3.5v3M17 3.5v3M3.5 9h17M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  sparkle: <><path d="m12 3 1.1 4.1L17 8.5l-3.9 1.4L12 14l-1.1-4.1L7 8.5l3.9-1.4L12 3ZM19 14l.55 2.05L21.5 17l-1.95.95L19 20l-.55-2.05L16.5 17l1.95-.95L19 14ZM5 14l.45 1.55L7 16l-1.55.45L5 18l-.45-1.55L3 16l1.55-.45L5 14Z" /></>,
  arrow: <><path d="M4 12h15M13 6l6 6-6 6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  eye: <><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3" /></>,
  shield: <><path d="M12 3.5 19 6v5.5c0 4.5-3 7.4-7 9-4-1.6-7-4.5-7-9V6l7-2.5Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
  message: <><path d="M4 5.5h16v11H9l-5 4v-15Z" /><path d="M8 10h8M8 13h5" /></>,
  upload: <><path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  dashboard: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  phone: <><path d="M6.5 4.5 9 4l1.5 4-2 1.5a14 14 0 0 0 4 4l1.5-2 4 1.5-.5 2.5c-.2 1-1 1.5-2 1.5C10.7 17 7 13.3 5 8.5c-.4-1.2.3-2.8 1.5-4Z" /></>,
  pin: <><path d="M18 10c0 4-6 10-6 10S6 14 6 10a6 6 0 1 1 12 0Z" /><circle cx="12" cy="10" r="2" /></>
};

export function Icon({ name, size = 20, className = '' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{paths[name]}</svg>;
}
