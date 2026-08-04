"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Theme = "notes" | "blueprint" | "ledger";
type Item = { id: number; room: string; title: string; status: "open" | "in_progress" | "completed" };
type Photo = { id: number; itemId: number; url: string; createdAt: string };

const starterItems: Item[] = [
  { id: 1, room: "Kitchen", title: "Touch up paint near kitchen window", status: "open" },
  { id: 2, room: "Kitchen", title: "Adjust cabinet door above refrigerator", status: "open" },
  { id: 3, room: "Primary Bedroom", title: "Fill nail holes behind closet door", status: "completed" },
  { id: 4, room: "Basement", title: "Seal gap around utility pipe", status: "completed" },
];

const starterRooms = ["Kitchen", "Living Room", "Primary Bedroom", "Bathroom", "Basement", "Exterior"];
const themes: { id: Theme; label: string; hint: string }[] = [
  { id: "notes", label: "Field notes", hint: "Warm paper" },
  { id: "blueprint", label: "Blueprint", hint: "House plans" },
  { id: "ledger", label: "Clean ledger", hint: "Simple & crisp" },
];

export default function Home() {
  const [items, setItems] = useState<Item[]>(starterItems);
  const [rooms, setRooms] = useState(starterRooms);
  const [room, setRoom] = useState("Kitchen");
  const [filter, setFilter] = useState("All rooms");
  const [theme, setTheme] = useState<Theme>("notes");
  const [showThemes, setShowThemes] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [task, setTask] = useState("");
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoItem, setPhotoItem] = useState<Item | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("punch-list-theme") as Theme | null;
    const frame = window.requestAnimationFrame(() => {
      if (saved && themes.some((entry) => entry.id === saved)) setTheme(saved);
    });
    Promise.all([
      fetch("/api/items").then((response) => response.ok ? response.json() : null),
      fetch("/api/rooms").then((response) => response.ok ? response.json() : null),
      fetch("/api/photos").then((response) => response.ok ? response.json() : null),
    ]).then(([itemData, roomData, photoData]) => {
      if (itemData?.items?.length) setItems(itemData.items);
      if (roomData?.rooms?.length) {
        const names = roomData.rooms.map((entry: { name: string }) => entry.name);
        setRooms(names);
        setRoom(names[0]);
      }
      if (photoData?.photos) setPhotos(photoData.photos);
    }).catch(() => undefined);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const shownItems = useMemo(() => items.filter((item) => filter === "All rooms" || item.room === filter), [items, filter]);
  const completed = items.filter((item) => item.status === "completed").length;
  const currentTheme = themes.find((entry) => entry.id === theme)!;

  function chooseTheme(next: Theme) {
    setTheme(next);
    window.localStorage.setItem("punch-list-theme", next);
    setShowThemes(false);
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();
    const title = task.trim();
    if (!title) return;
    const optimistic: Item = { id: Date.now(), room, title, status: "open" };
    setItems((current) => [...current, optimistic]);
    setTask("");
    setSaving(true);
    try {
      const response = await fetch("/api/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room, title, notes: "" }) });
      if (response.ok) {
        const data = await response.json();
        setItems((current) => current.map((item) => item.id === optimistic.id ? data.item : item));
      }
    } finally { setSaving(false); }
  }

  async function toggle(item: Item) {
    const status = item.status === "completed" ? "open" : "completed";
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status } : entry));
    setSaving(true);
    try {
      await fetch("/api/items", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, status, verified: false }) });
    } finally { setSaving(false); }
  }

  async function addRoom(event: FormEvent) {
    event.preventDefault();
    const name = newRoom.trim();
    if (!name || rooms.some((entry) => entry.toLowerCase() === name.toLowerCase())) return;
    setRooms((current) => [...current, name]);
    setRoom(name); setFilter(name); setNewRoom(""); setShowRoomForm(false);
    await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
  }

  return (
    <main className={`site theme-${theme}`}>
      <div className="ambient-house" aria-hidden="true"><i className="roof" /><i className="wall" /><i className="door" /><i className="chimney" /></div>
      <header className="site-bar">
        <a className="wordmark" href="#top"><span className="mini-house">⌂</span> Punch House</a>
        <div className="design-control">
          <button className="design-button" onClick={() => setShowThemes(!showThemes)} aria-expanded={showThemes}><span className={`swatch ${theme}`} /> {currentTheme.label} <b>⌄</b></button>
          {showThemes && <div className="theme-menu">{themes.map((entry) => <button key={entry.id} className={theme === entry.id ? "selected" : ""} onClick={() => chooseTheme(entry.id)}><span className={`theme-preview ${entry.id}`} /><span><b>{entry.label}</b><small>{entry.hint}</small></span>{theme === entry.id && <em>✓</em>}</button>)}</div>}
        </div>
      </header>

      <section className="page" id="top">
        <div className="paper-holes" aria-hidden="true"><i /><i /><i /></div>
        <header className="page-head">
          <div><p className="kicker">123 Maple Street</p><h1>House punch list</h1><p className="date-line">Final walk-through · {items.length - completed} items remaining</p></div>
          <div className="progress-stamp"><strong>{completed}/{items.length}</strong><span>complete</span></div>
        </header>

        <form className="quick-add" onSubmit={addTask}>
          <span className="add-mark">+</span>
          <input value={task} onChange={(event) => setTask(event.target.value)} placeholder="Write the next item…" aria-label="New punch-list item" />
          <select value={room} onChange={(event) => setRoom(event.target.value)} aria-label="Room for new item">{rooms.map((name) => <option key={name}>{name}</option>)}</select>
          <button type="submit" disabled={!task.trim()}>Add</button>
        </form>

        <div className="room-strip">
          <div className="room-scroll">
            {["All rooms", ...rooms].map((name) => <button key={name} className={filter === name ? "active" : ""} onClick={() => setFilter(name)}>{name}<span>{name === "All rooms" ? items.length : items.filter((item) => item.room === name).length}</span></button>)}
          </div>
          <button className="new-room-button" onClick={() => setShowRoomForm(true)}>+ Room</button>
        </div>

        <section className="list-sheet" aria-label="Punch-list items">
          <div className="list-heading"><span className="number-col">No.</span><span className="task-col">Item</span><span className="room-col">Room</span><span className="photo-col">Photo</span><span className="status-col">Done</span></div>
          {shownItems.map((item, index) => <div className={`list-row ${item.status === "completed" ? "is-done" : ""}`} key={item.id}>
            <span className="number-col">{String(index + 1).padStart(2, "0")}</span>
            <button className="task-col task-title" onClick={() => toggle(item)}>{item.title}</button>
            <span className="room-col"><button className="room-tag" onClick={() => setFilter(item.room)}>{item.room}</button></span>
            <span className="photo-col"><button className="photo-button" onClick={() => setPhotoItem(item)} aria-label={`Photos for ${item.title}`}><span>▣</span>{photos.filter((photo) => photo.itemId === item.id).length > 0 && <em>{photos.filter((photo) => photo.itemId === item.id).length}</em>}</button></span>
            <span className="status-col"><button className="check" onClick={() => toggle(item)} aria-label={`${item.status === "completed" ? "Reopen" : "Complete"} ${item.title}`}>{item.status === "completed" ? "✓" : ""}</button></span>
          </div>)}
          {!shownItems.length && <div className="empty-line">No items in this room yet.</div>}
          <button className="last-line" onClick={() => document.querySelector<HTMLInputElement>(".quick-add input")?.focus()}>+ Add another line</button>
        </section>

        <footer className="paper-footer"><span>{saving ? "Saving…" : "All changes saved"}</span><button onClick={() => window.print()}>Print list</button></footer>
      </section>

      {showRoomForm && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowRoomForm(false)}><form className="room-dialog" onSubmit={addRoom}><button type="button" className="close" onClick={() => setShowRoomForm(false)}>×</button><span className="dialog-house">⌂</span><h2>Add a room</h2><p>Give this part of the house a name.</p><input autoFocus value={newRoom} onChange={(event) => setNewRoom(event.target.value)} placeholder="e.g. Guest Bedroom" /><div><button type="button" onClick={() => setShowRoomForm(false)}>Cancel</button><button type="submit" className="solid" disabled={!newRoom.trim()}>Add room</button></div></form></div>}
      {photoItem && <PhotoGallery item={photoItem} photos={photos.filter((photo) => photo.itemId === photoItem.id)} onClose={() => setPhotoItem(null)} onAdded={(photo) => setPhotos((current) => [...current, photo])} />}
    </main>
  );
}

function PhotoGallery({ item, photos, onClose, onAdded }: { item: Item; photos: Photo[]; onClose: () => void; onAdded: (photo: Photo) => void }) {
  const [index, setIndex] = useState(Math.max(0, photos.length - 1));
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const active = photos[index];

  async function upload(file?: File | Blob, name = "photo.jpg") {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file, name);
      body.append("itemId", String(item.id));
      const response = await fetch("/api/photos", { method: "POST", body });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      onAdded(data.photo);
      setIndex(photos.length);
      setEditing(false);
    } finally { setUploading(false); }
  }

  return <div className="gallery-backdrop" role="dialog" aria-modal="true" aria-label={`Photos for ${item.title}`}>
    <header className="gallery-head"><button onClick={onClose} aria-label="Close photos">×</button><div><span>{item.room}</span><b>{item.title}</b></div><em>{photos.length ? `${Math.min(index + 1, photos.length)} / ${photos.length}` : "No photos"}</em></header>
    <section className="gallery-stage">
      {!active && !editing ? <div className="gallery-empty"><span>▣</span><h2>No photos yet</h2><p>Take a photo or choose one from this device.</p></div> : editing && active ? <MarkupEditor src={active.url} onCancel={() => setEditing(false)} onSave={(blob) => upload(blob, `marked-${item.id}.jpg`)} /> : <img src={active.url} alt={`${item.title}, photo ${index + 1}`} />}
      {!editing && photos.length > 1 && <><button className="gallery-arrow previous" onClick={() => setIndex((index - 1 + photos.length) % photos.length)} aria-label="Previous photo">‹</button><button className="gallery-arrow next" onClick={() => setIndex((index + 1) % photos.length)} aria-label="Next photo">›</button></>}
    </section>
    {!editing && <footer className="gallery-actions"><button onClick={() => cameraInput.current?.click()}><span>▣</span><b>Open camera</b></button><button onClick={() => fileInput.current?.click()}><span>＋</span><b>Choose photo</b></button><button disabled={!active} onClick={() => setEditing(true)}><span>✎</span><b>Mark up</b></button><input ref={cameraInput} hidden type="file" accept="image/*" capture="environment" onChange={(event) => upload(event.target.files?.[0])} /><input ref={fileInput} hidden type="file" accept="image/*" onChange={(event) => upload(event.target.files?.[0])} /></footer>}
    {uploading && <div className="uploading">Saving photo…</div>}
  </div>;
}

function MarkupEditor({ src, onCancel, onSave }: { src: string; onCancel: () => void; onSave: (blob: Blob) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{ x: number; y: number; snapshot: ImageData } | null>(null);
  const [tool, setTool] = useState<"pen" | "circle" | "arrow">("circle");
  const [color, setColor] = useState("#ef5945");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const element = canvas.current;
      if (!element) return;
      const scale = Math.min(1, 1600 / image.width);
      element.width = Math.round(image.width * scale);
      element.height = Math.round(image.height * scale);
      element.getContext("2d")?.drawImage(image, 0, 0, element.width, element.height);
      setReady(true);
    };
    image.src = src;
  }, [src]);

  function coordinates(event: React.PointerEvent) {
    const element = canvas.current!; const bounds = element.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * (element.width / bounds.width), y: (event.clientY - bounds.top) * (element.height / bounds.height) };
  }
  function start(event: React.PointerEvent) {
    if (!canvas.current || !ready) return;
    const point = coordinates(event); const context = canvas.current.getContext("2d")!;
    drawing.current = { ...point, snapshot: context.getImageData(0, 0, canvas.current.width, canvas.current.height) };
    canvas.current.setPointerCapture(event.pointerId);
  }
  function draw(event: React.PointerEvent) {
    if (!drawing.current || !canvas.current) return;
    const point = coordinates(event); const context = canvas.current.getContext("2d")!; const start = drawing.current;
    context.putImageData(start.snapshot, 0, 0); context.strokeStyle = color; context.fillStyle = color; context.lineWidth = Math.max(5, canvas.current.width / 170); context.lineCap = "round";
    if (tool === "circle") { context.beginPath(); context.ellipse((start.x + point.x) / 2, (start.y + point.y) / 2, Math.abs(point.x - start.x) / 2, Math.abs(point.y - start.y) / 2, 0, 0, Math.PI * 2); context.stroke(); }
    else if (tool === "arrow") { context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(point.x, point.y); context.stroke(); const angle = Math.atan2(point.y - start.y, point.x - start.x); const head = Math.max(22, canvas.current.width / 45); context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(point.x - head * Math.cos(angle - Math.PI / 6), point.y - head * Math.sin(angle - Math.PI / 6)); context.lineTo(point.x - head * Math.cos(angle + Math.PI / 6), point.y - head * Math.sin(angle + Math.PI / 6)); context.closePath(); context.fill(); }
    else { context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(point.x, point.y); context.stroke(); drawing.current = { ...point, snapshot: context.getImageData(0, 0, canvas.current.width, canvas.current.height) }; }
  }
  function save() { canvas.current?.toBlob((blob) => blob && onSave(blob), "image/jpeg", .92); }

  return <div className="markup"><canvas ref={canvas} onPointerDown={start} onPointerMove={draw} onPointerUp={() => drawing.current = null} /><div className="markup-bar"><button onClick={onCancel}>Cancel</button><div>{(["pen", "circle", "arrow"] as const).map((entry) => <button key={entry} className={tool === entry ? "active" : ""} onClick={() => setTool(entry)}><span>{entry === "pen" ? "✎" : entry === "circle" ? "○" : "↗"}</span>{entry}</button>)}<label><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><i style={{ background: color }} />Color</label></div><button className="save-markup" onClick={save} disabled={!ready}>Save copy</button></div></div>;
}
