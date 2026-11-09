// Small outline icons (inline SVG, no icon library to download).
const PATHS: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5",
  customers: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.2a3.25 3.25 0 0 1 0 6.1",
  categories: "M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z",
  photos: "M4 8h3l1.5-2h7L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  reminders: "M18 16v-5a6 6 0 1 0-12 0v5l-1.5 2h15zM10 20a2 2 0 0 0 4 0",
  shipments: "M3 6.5h11v9H3zM14 9.5h4l3 3v3h-7zM7 18.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM17 18.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z",
  masters: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1",
  finished: "M4 7.5h16V19H4zM3 4.5h18v3H3zM10 12h4",
  logout: "M9 4.5H5v15h4M16 8l4 4-4 4M20 12H9.5",
  menu: "M4 6.5h16M4 12h16M4 17.5h16",
  chevron: "m6 9 6 6 6-6",
  plus: "M12 5v14M5 12h14",
  // field type icons (form builder)
  text: "M4 7h16M4 12h10M4 17h13",
  longtext: "M4 6h16M4 10.5h16M4 15h16M4 19.5h9",
  number: "M9 4 7 20M17 4l-2 16M4 9h16M3.5 15h16",
  phone: "M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4.5 6a2 2 0 0 1 2-2Z",
  date: "M4 6.5h16V20H4zM4 10.5h16M8 3.5v4M16 3.5v4",
  time: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 7.5V12l3 2",
  select: "M4 7h16v10H4zM14 11l2 2 2-2",
  radio: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  checkboxes: "M4 4h16v16H4zM8 12.5l3 3 5-6",
  yesno: "M3 8.5h10M3 15.5h10M17 5l-3 3 3 3M20 13l-3 3 3 3",
  picture: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 10a1.25 1.25 0 1 0 0-2.5A1.25 1.25 0 0 0 9 10Z",
  heading: "M6 4v16M18 4v16M6 12h12",
  note: "M5 4h14v16H5zM8.5 9h7M8.5 13h7M8.5 17h4",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  trash: "M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  close: "M6 6l12 12M18 6 6 18",
  check: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.5 12.5l2.5 2.5 4.5-5",
  alert: "M12 4 3 19.5h18zM12 10v4.5M12 17h.01",
  info: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 11v5M12 8h.01",
  arrow: "M5 12h14M13 6l6 6-6 6",
  clock: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 7.5V12l3 2",
  download: "M12 4v11M7.5 11 12 15.5 16.5 11M5 19.5h14",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  group: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  box: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
};

export function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "grip" ? 3 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? PATHS.text} />
    </svg>
  );
}
