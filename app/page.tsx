"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { downloadPunchListPdf } from "./report-pdf";

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
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [address, setAddress] = useState("123 Maple Street");
  const [editingAddress, setEditingAddress] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [quickPhoto, setQuickPhoto] = useState<string | null>(null);
  const quickCamera = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("punch-list-theme") as Theme | null;
    const frame = window.requestAnimationFrame(() => {
      if (saved && themes.some((entry) => entry.id === saved)) setTheme(saved);
    });
    Promise.all([
      fetch("/api/items").then((response) => response.ok ? response.json() : null),
      fetch("/api/rooms").then((response) => response.ok ? response.json() : null),
      fetch("/api/photos").then((response) => response.ok ? response.json() : null),
      fetch("/api/settings").then((response) => response.ok ? response.json() : null),
    ]).then(([itemData, roomData, photoData, settingsData]) => {
      if (itemData?.items?.length) setItems(itemData.items);
      if (roomData?.rooms?.length) {
        const names = roomData.rooms.map((entry: { name: string }) => entry.name);
        setRooms(names);
        setRoom(names[0]);
      }
      if (photoData?.photos) setPhotos(photoData.photos);
      if (settingsData?.address) setAddress(settingsData.address);
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

  async function createTask(photo?: Blob) {
    const title = task.trim();
    if (!title) return null;
    const optimistic: Item = { id: Date.now(), room, title, status: "open" };
    setItems((current) => [...current, optimistic]);
    setTask("");
    setSaving(true);
    try {
      const response = await fetch("/api/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room, title, notes: "" }) });
      if (response.ok) {
        const data = await response.json();
        setItems((current) => current.map((item) => item.id === optimistic.id ? data.item : item));
        if (photo) await uploadPhoto(data.item.id, photo, `camera-${data.item.id}.jpg`);
        return data.item as Item;
      }
    } finally { setSaving(false); }
    return null;
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();
    await createTask();
  }

  async function uploadPhoto(itemId: number, file: Blob, name: string) {
    const body = new FormData(); body.append("file", file, name); body.append("itemId", String(itemId));
    const response = await fetch("/api/photos", { method: "POST", body });
    if (response.ok) { const data = await response.json(); setPhotos((current) => [...current, data.photo]); }
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

  async function updateLine(changes: Item) {
    setItems((current) => current.map((item) => item.id === changes.id ? changes : item)); setEditItem(null); setSaving(true);
    try { await fetch("/api/items", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(changes) }); } finally { setSaving(false); }
  }

  async function deleteLine(item: Item) {
    if (!window.confirm(`Delete “${item.title}” and its photos?`)) return;
    const response = await fetch(`/api/items?id=${item.id}`, { method: "DELETE" });
    if (response.ok) { setItems((current) => current.filter((entry) => entry.id !== item.id)); setPhotos((current) => current.filter((photo) => photo.itemId !== item.id)); setEditItem(null); }
  }

  async function deleteRoom(name: string) {
    setRoomError("");
    const response = await fetch(`/api/rooms?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (response.ok) { setRooms((current) => current.filter((entry) => entry !== name)); if (filter === name) setFilter("All rooms"); if (room === name) setRoom(rooms.find((entry) => entry !== name) ?? ""); }
    else { const data = await response.json(); setRoomError(data.error ?? "This room could not be deleted."); }
  }

  async function saveAddress(next: string) {
    const value = next.trim(); if (!value) return;
    setAddress(value); setEditingAddress(false);
    await fetch("/api/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: value }) });
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
          <div>{editingAddress ? <AddressEditor value={address} onCancel={() => setEditingAddress(false)} onSave={saveAddress} /> : <button className="kicker address-button" onClick={() => setEditingAddress(true)} title="Change address">{address} <span>✎</span></button>}<h1>House punch list</h1><p className="date-line">Final walk-through · {items.length - completed} items remaining</p></div>
          <div className="progress-stamp"><strong>{completed}/{items.length}</strong><span>complete</span></div>
        </header>

        <form className="quick-add" onSubmit={addTask}>
          <span className="add-mark">+</span>
          <input value={task} onChange={(event) => setTask(event.target.value)} placeholder="Write the next item…" aria-label="New punch-list item" />
          <button type="button" className="quick-camera" disabled={!task.trim()} onClick={() => quickCamera.current?.click()} aria-label="Take a photo for this new item">▣</button>
          <input ref={quickCamera} hidden type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) setQuickPhoto(URL.createObjectURL(file)); event.target.value = ""; }} />
          <select value={room} onChange={(event) => setRoom(event.target.value)} aria-label="Room for new item">{rooms.map((name) => <option key={name}>{name}</option>)}</select>
          <button type="submit" disabled={!task.trim()}>Add</button>
        </form>

        <div className="room-strip">
          <div className="room-scroll">
            {["All rooms", ...rooms].map((name) => <button key={name} className={filter === name ? "active" : ""} onClick={() => setFilter(name)}>{name}<span>{name === "All rooms" ? items.length : items.filter((item) => item.room === name).length}</span></button>)}
          </div>
          <button className="new-room-button" onClick={() => { setRoomError(""); setShowRoomForm(true); }}>Manage rooms</button>
        </div>

        <section className="list-sheet" aria-label="Punch-list items">
          <div className="list-heading"><span className="number-col">No.</span><span className="task-col">Item</span><span className="room-col">Room</span><span className="photo-col">Photo</span><span className="status-col">Done</span><span className="action-col" /></div>
          {shownItems.map((item, index) => <div className={`list-row ${item.status === "completed" ? "is-done" : ""}`} key={item.id}>
            <span className="number-col">{String(index + 1).padStart(2, "0")}</span>
            <div className="task-col task-cell"><button className="task-title" onClick={() => toggle(item)}>{item.title}</button>{photos.some((photo) => photo.itemId === item.id) && <span className="print-photo-links">Photos: {photos.filter((photo) => photo.itemId === item.id).map((photo, photoIndex) => <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">Photo {photoIndex + 1}</a>)}</span>}</div>
            <span className="room-col"><button className="room-tag" onClick={() => setFilter(item.room)}>{item.room}</button></span>
            <span className="photo-col"><button className="photo-button" onClick={() => setPhotoItem(item)} aria-label={`Photos for ${item.title}`}><span>▣</span>{photos.filter((photo) => photo.itemId === item.id).length > 0 && <em>{photos.filter((photo) => photo.itemId === item.id).length}</em>}</button></span>
            <span className="status-col"><button className="check" onClick={() => toggle(item)} aria-label={`${item.status === "completed" ? "Reopen" : "Complete"} ${item.title}`}>{item.status === "completed" ? "✓" : ""}</button></span>
            <span className="action-col"><button className="row-edit" onClick={() => setEditItem(item)} aria-label={`Edit ${item.title}`}>•••</button></span>
          </div>)}
          {!shownItems.length && <div className="empty-line">No items in this room yet.</div>}
          <button className="last-line" onClick={() => document.querySelector<HTMLInputElement>(".quick-add input")?.focus()}>+ Add another line</button>
        </section>

        <footer className="paper-footer"><span>{saving ? "Saving…" : "All changes saved"}</span><button onClick={() => downloadPunchListPdf(address, items, photos)}>Download PDF</button></footer>
      </section>

      {showRoomForm && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowRoomForm(false)}><form className="room-dialog manage-rooms" onSubmit={addRoom}><button type="button" className="close" onClick={() => setShowRoomForm(false)}>×</button><span className="dialog-house">⌂</span><h2>Manage rooms</h2><p>Add a room, or remove an empty one.</p><div className="room-manager-list">{rooms.map((name) => <div key={name}><span>{name}<small>{items.filter((item) => item.room === name).length} items</small></span><button type="button" onClick={() => deleteRoom(name)} aria-label={`Delete ${name}`}>Delete</button></div>)}</div>{roomError && <div className="room-error">{roomError}</div>}<input value={newRoom} onChange={(event) => setNewRoom(event.target.value)} placeholder="New room name" /><div><button type="button" onClick={() => setShowRoomForm(false)}>Done</button><button type="submit" className="solid" disabled={!newRoom.trim()}>Add room</button></div></form></div>}
      {editItem && <EditItemDialog item={editItem} rooms={rooms} onSave={updateLine} onDelete={deleteLine} onClose={() => setEditItem(null)} />}
      {photoItem && <PhotoGallery item={photoItem} photos={photos.filter((photo) => photo.itemId === photoItem.id)} onClose={() => setPhotoItem(null)} onAdded={(photo) => setPhotos((current) => [...current, photo])} />}
      {quickPhoto && <div className="gallery-backdrop quick-markup"><header className="gallery-head"><button onClick={() => setQuickPhoto(null)}>×</button><div><span>New item · {room}</span><b>{task}</b></div><em>Mark up before adding</em></header><section className="gallery-stage"><MarkupEditor src={quickPhoto} onCancel={() => setQuickPhoto(null)} saveLabel="Add item" onSave={async (blob) => { setQuickPhoto(null); await createTask(blob); }} /></section></div>}
    </main>
  );
}

function AddressEditor({ value, onSave, onCancel }: { value: string; onSave: (value: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(value);
  return <form className="address-editor" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Escape" && onCancel()} /><button type="submit">Save</button></form>;
}

function EditItemDialog({ item, rooms, onSave, onDelete, onClose }: { item: Item; rooms: string[]; onSave: (item: Item) => void; onDelete: (item: Item) => void; onClose: () => void }) {
  const [title, setTitle] = useState(item.title); const [room, setRoom] = useState(item.room);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="room-dialog edit-dialog" onSubmit={(event) => { event.preventDefault(); if (title.trim()) onSave({ ...item, title: title.trim(), room }); }}><button type="button" className="close" onClick={onClose}>×</button><h2>Edit line</h2><label>Item<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Room<select value={room} onChange={(event) => setRoom(event.target.value)}>{rooms.map((name) => <option key={name}>{name}</option>)}</select></label><button type="button" className="delete-line" onClick={() => onDelete(item)}>Delete this line</button><div><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="solid">Save changes</button></div></form></div>;
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

function MarkupEditor({ src, onCancel, onSave, saveLabel = "Save copy" }: { src: string; onCancel: () => void; onSave: (blob: Blob) => void; saveLabel?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{ x: number; y: number; snapshot: ImageData } | null>(null);
  const history = useRef<ImageData[]>([]);
  const original = useRef<ImageData | null>(null);
  const [tool, setTool] = useState<"pen" | "circle" | "arrow" | "text">("pen");
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
      const context = element.getContext("2d")!; context.drawImage(image, 0, 0, element.width, element.height);
      original.current = context.getImageData(0, 0, element.width, element.height); history.current = [];
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
    history.current.push(context.getImageData(0, 0, canvas.current.width, canvas.current.height));
    if (tool === "text") {
      const label = window.prompt("Text to place on the photo:");
      if (!label) { history.current.pop(); return; }
      context.fillStyle = color; context.font = `700 ${Math.max(26, canvas.current.width / 24)}px Arial`; context.textBaseline = "top"; context.fillText(label, point.x, point.y);
      return;
    }
    drawing.current = { ...point, snapshot: context.getImageData(0, 0, canvas.current.width, canvas.current.height) };
    canvas.current.setPointerCapture(event.pointerId);
  }
  function draw(event: React.PointerEvent) {
    if (!drawing.current || !canvas.current) return;
    const point = coordinates(event); const context = canvas.current.getContext("2d")!; const start = drawing.current;
    context.strokeStyle = color; context.fillStyle = color; context.lineWidth = Math.max(5, canvas.current.width / 170); context.lineCap = "round";
    if (tool === "circle") { context.putImageData(start.snapshot, 0, 0); context.beginPath(); context.ellipse((start.x + point.x) / 2, (start.y + point.y) / 2, Math.abs(point.x - start.x) / 2, Math.abs(point.y - start.y) / 2, 0, 0, Math.PI * 2); context.stroke(); }
    else if (tool === "arrow") { context.putImageData(start.snapshot, 0, 0); context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(point.x, point.y); context.stroke(); const angle = Math.atan2(point.y - start.y, point.x - start.x); const head = Math.max(22, canvas.current.width / 45); context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(point.x - head * Math.cos(angle - Math.PI / 6), point.y - head * Math.sin(angle - Math.PI / 6)); context.lineTo(point.x - head * Math.cos(angle + Math.PI / 6), point.y - head * Math.sin(angle + Math.PI / 6)); context.closePath(); context.fill(); }
    else if (tool === "pen") { context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(point.x, point.y); context.stroke(); drawing.current = { ...point, snapshot: start.snapshot }; }
  }
  function undo() { const previous = history.current.pop(); if (previous && canvas.current) canvas.current.getContext("2d")?.putImageData(previous, 0, 0); }
  function reset() { if (original.current && canvas.current) { canvas.current.getContext("2d")?.putImageData(original.current, 0, 0); history.current = []; } }
  function save() { canvas.current?.toBlob((blob) => blob && onSave(blob), "image/jpeg", .92); }

  return <div className="markup"><canvas ref={canvas} onPointerDown={start} onPointerMove={draw} onPointerUp={() => drawing.current = null} /><div className="markup-bar"><div className="markup-left"><button onClick={onCancel}>Cancel</button><button onClick={undo}>↶ Undo</button><button onClick={reset}>Reset</button></div><div>{(["pen", "circle", "arrow", "text"] as const).map((entry) => <button key={entry} className={tool === entry ? "active" : ""} onClick={() => setTool(entry)}><span>{entry === "pen" ? "✎" : entry === "circle" ? "○" : entry === "arrow" ? "↗" : "T"}</span>{entry}</button>)}<label><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><i style={{ background: color }} />Color</label></div><button className="save-markup" onClick={save} disabled={!ready}>{saveLabel}</button></div></div>;
}
