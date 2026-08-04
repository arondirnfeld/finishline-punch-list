"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Status = "open" | "in_progress" | "completed";
type Role = "owner" | "contractor";

type PunchItem = {
  id: number;
  room: string;
  title: string;
  notes: string;
  status: Status;
  verified: boolean;
  beforePhoto?: string | null;
  afterPhoto?: string | null;
  updatedAt: string;
};

const seedItems: PunchItem[] = [
  { id: 1, room: "Kitchen", title: "Touch up paint near kitchen window", notes: "Small chip along the lower right trim.", status: "open", verified: false, beforePhoto: null, afterPhoto: null, updatedAt: "Today" },
  { id: 2, room: "Kitchen", title: "Adjust cabinet door above refrigerator", notes: "Door rubs when closing.", status: "in_progress", verified: false, beforePhoto: null, afterPhoto: null, updatedAt: "Yesterday" },
  { id: 3, room: "Primary Bedroom", title: "Fill nail holes behind closet door", notes: "Three holes at eye level.", status: "completed", verified: false, beforePhoto: null, afterPhoto: null, updatedAt: "Aug 2" },
  { id: 4, room: "Basement", title: "Seal gap around utility pipe", notes: "Draft visible along the exterior wall.", status: "completed", verified: true, beforePhoto: null, afterPhoto: null, updatedAt: "Aug 1" },
];

const rooms = ["Kitchen", "Living Room", "Primary Bedroom", "Bedroom 2", "Bathroom", "Basement", "Exterior", "Other"];
const statusLabel: Record<Status, string> = { open: "Open", in_progress: "In progress", completed: "Completed" };

export default function Home() {
  const [items, setItems] = useState<PunchItem[]>(seedItems);
  const [activeRoom, setActiveRoom] = useState("All rooms");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [role, setRole] = useState<Role>("owner");
  const [sheet, setSheet] = useState<"new" | "detail" | "photo" | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => data.items?.length && setItems(data.items))
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(() => items.filter((item) =>
    (activeRoom === "All rooms" || item.room === activeRoom) &&
    (statusFilter === "all" || item.status === statusFilter)
  ), [items, activeRoom, statusFilter]);

  const grouped = useMemo(() => Object.entries(filtered.reduce<Record<string, PunchItem[]>>((acc, item) => {
    (acc[item.room] ||= []).push(item);
    return acc;
  }, {})), [filtered]);

  const counts = useMemo(() => ({
    open: items.filter((i) => i.status === "open").length,
    in_progress: items.filter((i) => i.status === "in_progress").length,
    completed: items.filter((i) => i.status === "completed").length,
  }), [items]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  async function persist(payload: Partial<PunchItem> & { id?: number }) {
    setSyncing(true);
    try {
      const response = await fetch("/api/items", {
        method: payload.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      return data.item as PunchItem;
    } catch {
      return null;
    } finally {
      setSyncing(false);
    }
  }

  async function addItem(input: { room: string; title: string; notes: string; photo?: File }) {
    const optimistic: PunchItem = { id: Date.now(), ...input, status: "open", verified: false, beforePhoto: null, afterPhoto: null, updatedAt: "Just now" };
    setItems((current) => [optimistic, ...current]);
    setSheet(null);
    showToast("Issue added to the punch list");
    const saved = await persist(input);
    if (saved) setItems((current) => current.map((i) => i.id === optimistic.id ? saved : i));
    if (input.photo) await attachPhoto(saved?.id ?? optimistic.id, input.photo, "before");
  }

  async function updateItem(id: number, changes: Partial<PunchItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes, updatedAt: "Just now" } : item));
    await persist({ id, ...changes });
  }

  async function attachPhoto(id: number, file: File | Blob, kind: "before" | "after") {
    const preview = URL.createObjectURL(file);
    setItems((current) => current.map((item) => item.id === id ? { ...item, [kind === "before" ? "beforePhoto" : "afterPhoto"]: preview } : item));
    const body = new FormData();
    body.append("file", file, `punch-${id}-${kind}.jpg`);
    body.append("itemId", String(id));
    body.append("kind", kind);
    try {
      const response = await fetch("/api/photos", { method: "POST", body });
      if (response.ok) {
        const data = await response.json();
        setItems((current) => current.map((item) => item.id === id ? { ...item, [kind === "before" ? "beforePhoto" : "afterPhoto"]: data.url } : item));
      }
    } catch { /* local preview remains usable */ }
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function shareProject() {
    const shareData = { title: "Maple Street Punch List", text: `${items.length} house items — ${counts.open + counts.in_progress} still active`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(window.location.href); showToast("Share link copied"); }
    } catch { /* share dismissed */ }
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">✓</span><span>FinishLine</span></div>
        <div className="top-actions">
          <div className="role-switch" aria-label="Preview role">
            <button className={role === "owner" ? "active" : ""} onClick={() => setRole("owner")}>Owner</button>
            <button className={role === "contractor" ? "active" : ""} onClick={() => setRole("contractor")}>Contractor</button>
          </div>
          <button className="icon-button" onClick={shareProject} aria-label="Share project">↗</button>
          <button className="avatar" aria-label="Account">AM</button>
        </div>
      </header>

      <section className="project-head">
        <div>
          <p className="eyebrow">123 Maple Street</p>
          <h1>Punch list</h1>
          <p className="subtitle">Final details before this house feels finished.</p>
        </div>
        <div className="head-actions">
          <button className="secondary" onClick={() => window.print()}><span>⇩</span> PDF report</button>
          <button className="primary desktop-add" onClick={() => setSheet("new")}><span>＋</span> Add issue</button>
        </div>
      </section>

      <section className="summary" aria-label="Project status">
        <button onClick={() => setStatusFilter(statusFilter === "open" ? "all" : "open")} className={statusFilter === "open" ? "selected" : ""}>
          <span className="summary-number">{counts.open}</span><span><b>Open</b><small>Needs attention</small></span>
        </button>
        <button onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")} className={statusFilter === "in_progress" ? "selected" : ""}>
          <span className="summary-number amber">{counts.in_progress}</span><span><b>In progress</b><small>Being repaired</small></span>
        </button>
        <button onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")} className={statusFilter === "completed" ? "selected" : ""}>
          <span className="summary-number green">{counts.completed}</span><span><b>Completed</b><small>{items.filter(i => i.verified).length} verified</small></span>
        </button>
        <div className="progress-wrap"><div className="progress-copy"><span>Overall progress</span><b>{items.length ? Math.round((counts.completed / items.length) * 100) : 0}%</b></div><div className="progress"><i style={{ width: `${items.length ? (counts.completed / items.length) * 100 : 0}%` }} /></div></div>
      </section>

      <nav className="room-tabs" aria-label="Filter by room">
        {["All rooms", ...rooms].map((room) => <button key={room} className={activeRoom === room ? "active" : ""} onClick={() => setActiveRoom(room)}>{room}{room !== "All rooms" && <span>{items.filter(i => i.room === room).length}</span>}</button>)}
      </nav>

      <section className="list-area">
        <div className="list-toolbar"><p><b>{filtered.length} {filtered.length === 1 ? "item" : "items"}</b> · Sorted by room</p><span className={syncing ? "sync syncing" : "sync"}>● {syncing ? "Saving…" : "All changes saved"}</span></div>
        {grouped.length ? grouped.map(([room, roomItems]) => (
          <div className="room-group" key={room}>
            <div className="room-title"><h2>{room}</h2><span>{roomItems.length} {roomItems.length === 1 ? "item" : "items"}</span></div>
            <div className="cards">
              {roomItems.map((item) => <ItemCard key={item.id} item={item} role={role} onOpen={() => { setSelectedId(item.id); setSheet("detail"); }} onCamera={() => { setSelectedId(item.id); setSheet("photo"); }} onStatus={(status) => updateItem(item.id, { status, verified: status !== "completed" ? false : item.verified })} onVerify={() => { updateItem(item.id, { verified: true }); showToast("Repair verified"); }} />)}
            </div>
          </div>
        )) : <div className="empty"><span>✓</span><h2>Nothing here</h2><p>Try another room or status filter.</p></div>}
      </section>

      <button className="walk-add" onClick={() => setSheet("new")}><span>＋</span><b>Add issue</b><small>Camera ready</small></button>
      {sheet === "new" && <NewIssue onClose={() => setSheet(null)} onSave={addItem} />}
      {sheet === "detail" && selected && <DetailSheet item={selected} role={role} onClose={() => setSheet(null)} onStatus={(status) => updateItem(selected.id, { status, verified: status !== "completed" ? false : selected.verified })} onVerify={() => updateItem(selected.id, { verified: true })} onPhoto={() => setSheet("photo")} />}
      {sheet === "photo" && selected && <PhotoEditor item={selected} onClose={() => setSheet("detail")} onSave={async (blob, kind) => { await attachPhoto(selected.id, blob, kind); setSheet("detail"); showToast(`${kind === "before" ? "Before" : "After"} photo saved`); }} />}
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}

function ItemCard({ item, role, onOpen, onCamera, onStatus, onVerify }: { item: PunchItem; role: Role; onOpen: () => void; onCamera: () => void; onStatus: (s: Status) => void; onVerify: () => void }) {
  return <article className={`item-card ${item.status === "completed" ? "done" : ""}`}>
    <button className="item-main" onClick={onOpen}>
      <span className={`status-dot ${item.status}`}>{item.status === "completed" ? "✓" : ""}</span>
      <span className="item-copy"><strong>{item.title}</strong><small>{item.notes || "No additional notes"}</small><span className="meta"><i className={`pill ${item.status}`}>{statusLabel[item.status]}</i>{item.verified && <i className="verified">✓ Verified</i>}<em>Updated {item.updatedAt}</em></span></span>
    </button>
    <div className="card-actions">
      <button className="camera" onClick={onCamera} aria-label={`Add photo to ${item.title}`}>▣<span>{item.beforePhoto || item.afterPhoto ? "Add photo" : "Photo"}</span></button>
      {role === "contractor" && item.status !== "completed" && <button className="complete-action" onClick={() => onStatus("completed")}>Mark complete</button>}
      {role === "owner" && item.status === "completed" && !item.verified && <button className="verify-action" onClick={onVerify}>Verify</button>}
      <button className="chevron" onClick={onOpen} aria-label="Open item">›</button>
    </div>
  </article>;
}

function NewIssue({ onClose, onSave }: { onClose: () => void; onSave: (data: { room: string; title: string; notes: string; photo?: File }) => void }) {
  const [title, setTitle] = useState(""); const [room, setRoom] = useState("Kitchen"); const [notes, setNotes] = useState(""); const [photo, setPhoto] = useState<File>();
  const input = useRef<HTMLInputElement>(null);
  return <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="sheet new-sheet"><header><div><p className="eyebrow">New punch item</p><h2>What needs fixing?</h2></div><button onClick={onClose}>×</button></header><div className="sheet-body">
    <label>Short description<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Touch up paint near window" /></label>
    <label>Room<select value={room} onChange={(e) => setRoom(e.target.value)}>{rooms.map(r => <option key={r}>{r}</option>)}</select></label>
    <button className={`capture ${photo ? "has-photo" : ""}`} onClick={() => input.current?.click()}><span>{photo ? "✓" : "▣"}</span><b>{photo ? photo.name : "Take a photo"}</b><small>{photo ? "Tap to replace" : "Opens your camera immediately"}</small></button>
    <input ref={input} hidden type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0])} />
    <label>Notes <span>Optional</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any useful detail for the contractor…" /></label>
  </div><footer><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={!title.trim()} onClick={() => onSave({ room, title: title.trim(), notes: notes.trim(), photo })}>Save issue</button></footer></section></div>;
}

function DetailSheet({ item, role, onClose, onStatus, onVerify, onPhoto }: { item: PunchItem; role: Role; onClose: () => void; onStatus: (s: Status) => void; onVerify: () => void; onPhoto: () => void }) {
  return <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="sheet detail-sheet"><header><div><p className="eyebrow">{item.room} · Item #{item.id}</p><h2>{item.title}</h2></div><button onClick={onClose}>×</button></header><div className="sheet-body">
    <div className="status-control"><p>Status</p>{(["open", "in_progress", "completed"] as Status[]).map(s => <button key={s} className={item.status === s ? `active ${s}` : ""} onClick={() => onStatus(s)}>{s === "completed" ? "✓ " : ""}{statusLabel[s]}</button>)}</div>
    <div className="detail-notes"><p>Notes</p><div>{item.notes || "No notes were added."}</div></div>
    <div className="photo-pair"><PhotoTile label="Before" src={item.beforePhoto} onClick={onPhoto} /><PhotoTile label="After" src={item.afterPhoto} onClick={onPhoto} /></div>
    {item.status === "completed" && !item.verified && role === "owner" && <div className="verify-box"><span>✓</span><div><b>Ready for your review</b><p>Check the repair and verify that it’s finished.</p></div><button onClick={onVerify}>Verify repair</button></div>}
    {item.verified && <div className="verified-box">✓ Repair verified by owner</div>}
  </div><footer><button className="secondary" onClick={onPhoto}>▣ Add photo</button>{role === "contractor" && item.status !== "completed" ? <button className="primary" onClick={() => onStatus("completed")}>Mark complete</button> : <button className="primary" onClick={onClose}>Done</button>}</footer></section></div>;
}

function PhotoTile({ label, src, onClick }: { label: string; src?: string | null; onClick: () => void }) {
  return <button className="photo-tile" onClick={onClick}>{src ? <img src={src} alt={`${label} repair`} /> : <span>▣</span>}<b>{label}</b><small>{src ? "Tap to replace or mark up" : "Add photo"}</small></button>; // eslint-disable-line @next/next/no-img-element
}

function PhotoEditor({ item, onClose, onSave }: { item: PunchItem; onClose: () => void; onSave: (blob: Blob, kind: "before" | "after") => void }) {
  const [kind, setKind] = useState<"before" | "after">(item.status === "completed" ? "after" : "before");
  const [fileUrl, setFileUrl] = useState<string | null>(null); const [tool, setTool] = useState<"pen" | "circle" | "arrow">("circle"); const [color, setColor] = useState("#ef5b45");
  const canvas = useRef<HTMLCanvasElement>(null); const input = useRef<HTMLInputElement>(null); const drawing = useRef<{ x: number; y: number; snapshot: ImageData } | null>(null);
  function loadFile(file?: File) { if (file) setFileUrl(URL.createObjectURL(file)); }
  useEffect(() => { if (!fileUrl || !canvas.current) return; const img = new Image(); img.onload = () => { const c = canvas.current!; const max = 1100; const scale = Math.min(1, max / img.width); c.width = img.width * scale; c.height = img.height * scale; c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height); }; img.src = fileUrl; }, [fileUrl]);
  function point(e: React.PointerEvent) { const r = canvas.current!.getBoundingClientRect(); return { x: (e.clientX-r.left)*(canvas.current!.width/r.width), y: (e.clientY-r.top)*(canvas.current!.height/r.height) }; }
  function down(e: React.PointerEvent) { if (!canvas.current) return; const p = point(e); const ctx = canvas.current.getContext("2d")!; drawing.current = { ...p, snapshot: ctx.getImageData(0, 0, canvas.current.width, canvas.current.height) }; canvas.current.setPointerCapture(e.pointerId); }
  function move(e: React.PointerEvent) { if (!drawing.current || !canvas.current) return; const p = point(e); const ctx = canvas.current.getContext("2d")!; ctx.putImageData(drawing.current.snapshot, 0, 0); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(5, canvas.current.width / 180); ctx.lineCap = "round"; const s = drawing.current;
    if (tool === "circle") { ctx.beginPath(); ctx.ellipse((s.x+p.x)/2,(s.y+p.y)/2,Math.abs(p.x-s.x)/2,Math.abs(p.y-s.y)/2,0,0,Math.PI*2); ctx.stroke(); }
    else if (tool === "arrow") { ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(p.x,p.y); ctx.stroke(); const a=Math.atan2(p.y-s.y,p.x-s.x), h=24; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-h*Math.cos(a-Math.PI/6),p.y-h*Math.sin(a-Math.PI/6)); ctx.lineTo(p.x-h*Math.cos(a+Math.PI/6),p.y-h*Math.sin(a+Math.PI/6)); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(p.x,p.y); ctx.stroke(); drawing.current = { ...p, snapshot: ctx.getImageData(0, 0, canvas.current.width, canvas.current.height) }; }
  }
  function save() { canvas.current?.toBlob((blob) => blob && onSave(blob, kind), "image/jpeg", .9); }
  return <div className="overlay dark"><section className="photo-editor"><header><button onClick={onClose}>×</button><div><b>Photo markup</b><small>{item.title}</small></div><button className="save-photo" disabled={!fileUrl} onClick={save}>Save</button></header>
    {!fileUrl ? <div className="camera-empty"><span>▣</span><h2>Take a clear photo</h2><p>You can circle, draw, or add an arrow next.</p><button onClick={() => input.current?.click()}>Open camera</button><input ref={input} hidden type="file" accept="image/*" capture="environment" onChange={(e) => loadFile(e.target.files?.[0])} /></div> : <div className="canvas-wrap"><canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={() => drawing.current = null} /></div>}
    <footer><div className="photo-kind"><button className={kind === "before" ? "active" : ""} onClick={() => setKind("before")}>Before</button><button className={kind === "after" ? "active" : ""} onClick={() => setKind("after")}>After</button></div><div className="tools">{(["pen","circle","arrow"] as const).map(t => <button key={t} className={tool === t ? "active" : ""} onClick={() => setTool(t)}>{t === "pen" ? "✎" : t === "circle" ? "○" : "↗"}<small>{t}</small></button>)}<label className="color"><input type="color" value={color} onChange={e => setColor(e.target.value)} /><span style={{ background: color }} /><small>Color</small></label></div></footer>
  </section></div>;
}
