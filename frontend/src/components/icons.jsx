// Line icons (24 px grid, drawn with the current text colour). Decorative: always paired with text.
const SHAPES = {
  dashboard: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  intake: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M12 8v8', 'M8 12h8'],
  search: [{ c: [11, 11, 7] }, 'M21 21l-4.3-4.3'],
  scan: ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2', 'M7 12h10'],
  review: ['M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2', 'M9 3h6v4H9z', 'M9 14l2 2 4-4'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  scale: [{ c: [12, 5, 3] }, 'M6.5 8h11l3 13h-17z'],
  pin: ['M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z', { c: [12, 10, 3] }],
  report: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h8'],
  history: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l4 2'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', { c: [12, 7, 4] }],
  menu: ['M3 6h18', 'M3 12h18', 'M3 18h18'],
  close: ['M18 6L6 18', 'M6 6l12 12'],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M22 7l-10 6L2 7'],
  truck: ['M1 3h15v13H1z', 'M16 8h4l3 3v5h-7z', { c: [5.5, 18.5, 2.5] }, { c: [18.5, 18.5, 2.5] }],
  camera: ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z', { c: [12, 13, 4] }],
  printer: ['M6 9V2h12v7', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', 'M6 14h12v8H6z'],
  check: ['M22 11.1V12a10 10 0 1 1-5.9-9.1', 'M22 4L12 14l-3-3'],
  alert: ['M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
  arrow: ['M5 12h14', 'M12 5l7 7-7 7'],
  plus: [{ c: [12, 12, 10] }, 'M12 8v8', 'M8 12h8'],
  inbox: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z'],
  clock: [{ c: [12, 12, 10] }, 'M12 6v6l4 2'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  trash: ['M3 6h18', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6', 'M10 11v6', 'M14 11v6'],
  tick: ['M20 6L9 17l-5-5'],
  chevron: ['M9 18l6-6-6-6'],
  back: ['M19 12H5', 'M12 19l-7-7 7-7'],
  info: [{ c: [12, 12, 10] }, 'M12 16v-4', 'M12 8h.01'],
  building: ['M3 21h18', 'M5 21V7l7-4 7 4v14', 'M9 21v-6h6v6', 'M9 10h.01', 'M15 10h.01'],
  calendar: ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z', { c: [12, 12, 3] }],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  refresh: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.5 9a9 9 0 0 1 14.9-3.4L23 10', 'M1 14l4.6 4.4A9 9 0 0 0 20.5 15'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  rotateLeft: ['M1 4v6h6', 'M3.5 15a9 9 0 1 0 2.1-9.4L1 10'],
  rotateRight: ['M23 4v6h-6', 'M20.5 15a9 9 0 1 1-2.1-9.4L23 10'],
  play: ['M5 3l14 9-14 9z'],
  xcircle: [{ c: [12, 12, 10] }, 'M15 9l-6 6', 'M9 9l6 6'],
}

export default function Icon({ name, className = 'h-4 w-4' }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" className={`shrink-0 ${className}`}>
      {(SHAPES[name] || []).map((s, i) => (typeof s === 'string' ? <path key={i} d={s} /> : <circle key={i} cx={s.c[0]} cy={s.c[1]} r={s.c[2]} />))}
    </svg>
  )
}
