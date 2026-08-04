"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Theme = "notes" | "blueprint" | "ledger";
type Item = { id: number; room: string; title: string; status: "open" | "in_progress" | "completed" };

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

  useEffect(() => {
    const saved = window.localStorage.getItem("punch-list-theme") as Theme | null;
    const frame = window.requestAnimationFrame(() => {
      if (saved && themes.some((entry) => entry.id === saved)) setTheme(saved);
    });
    Promise.all([
      fetch("/api/items").then((response) => response.ok ? response.json() : null),
      fetch("/api/rooms").then((response) => response.ok ? response.json() : null),
    ]).then(([itemData, roomData]) => {
      if (itemData?.items?.length) setItems(itemData.items);
      if (roomData?.rooms?.length) {
        const names = roomData.rooms.map((entry: { name: string }) => entry.name);
        setRooms(names);
        setRoom(names[0]);
      }
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
          <div className="list-heading"><span className="number-col">No.</span><span className="task-col">Item</span><span className="room-col">Room</span><span className="status-col">Done</span></div>
          {shownItems.map((item, index) => <div className={`list-row ${item.status === "completed" ? "is-done" : ""}`} key={item.id}>
            <span className="number-col">{String(index + 1).padStart(2, "0")}</span>
            <button className="task-col task-title" onClick={() => toggle(item)}>{item.title}</button>
            <span className="room-col"><button className="room-tag" onClick={() => setFilter(item.room)}>{item.room}</button></span>
            <span className="status-col"><button className="check" onClick={() => toggle(item)} aria-label={`${item.status === "completed" ? "Reopen" : "Complete"} ${item.title}`}>{item.status === "completed" ? "✓" : ""}</button></span>
          </div>)}
          {!shownItems.length && <div className="empty-line">No items in this room yet.</div>}
          <button className="last-line" onClick={() => document.querySelector<HTMLInputElement>(".quick-add input")?.focus()}>+ Add another line</button>
        </section>

        <footer className="paper-footer"><span>{saving ? "Saving…" : "All changes saved"}</span><button onClick={() => window.print()}>Print list</button></footer>
      </section>

      {showRoomForm && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowRoomForm(false)}><form className="room-dialog" onSubmit={addRoom}><button type="button" className="close" onClick={() => setShowRoomForm(false)}>×</button><span className="dialog-house">⌂</span><h2>Add a room</h2><p>Give this part of the house a name.</p><input autoFocus value={newRoom} onChange={(event) => setNewRoom(event.target.value)} placeholder="e.g. Guest Bedroom" /><div><button type="button" onClick={() => setShowRoomForm(false)}>Cancel</button><button type="submit" className="solid" disabled={!newRoom.trim()}>Add room</button></div></form></div>}
    </main>
  );
}
