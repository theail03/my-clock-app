import { useState, useEffect, useRef } from "react";
import "./App.css";

export default function App() {
  /* ---------- helpers ---------- */
  const formatTime = (ms) => {
    const sec = Math.floor(ms / 1000);
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  /* ---------- state ---------- */
  const [title, setTitle] = useState("");
  const [entries, setEntries] = useState(() => {
    const stored = localStorage.getItem("timeEntries");
    return stored ? JSON.parse(stored) : [];
  });

  /* ---------- save / tick ---------- */
  useEffect(() => {
    localStorage.setItem("timeEntries", JSON.stringify(entries));
  }, [entries]);

  /* single setInterval to update running timers every second */
  const tickRef = useRef(null);
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setEntries((prev) =>
        prev.map((e) =>
          e.running ? { ...e, duration: Date.now() - e.start } : e
        )
      );
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  /* ---------- actions ---------- */
  const startEntry = (parentId = null) => {
    if (!title.trim() && parentId === null) return;
    const now = Date.now();
    setEntries((prev) => [
      ...prev,
      {
        id: now,
        parentId,
        title: parentId ? `Sub of ${parentId}` : title.trim(),
        start: now,
        duration: 0,
        running: true,
      },
    ]);
    if (parentId === null) setTitle("");
  };

  const stopEntry = (id) =>
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, running: false } : e))
    );

  /* ---------- UI helpers ---------- */
  const renderEntries = (parentId = null, level = 0) =>
    entries
      .filter((e) => e.parentId === parentId)
      .map((e) => (
        <div
          key={e.id}
          style={{ marginLeft: level * 20, display: "flex", gap: 8 }}
        >
          <span style={{ flex: 1 }}>
            {e.title} – {formatTime(e.duration)}
            {e.running ? " ⏱️" : ""}
          </span>
          {e.running ? (
            <button onClick={() => stopEntry(e.id)}>Stop</button>
          ) : null}
          <button onClick={() => startEntry(e.id)}>Add Sub-entry</button>
          {renderEntries(e.id, level + 1)}
        </div>
      ));

  /* ---------- render ---------- */
  return (
    <div className="container">
      <h1>Time Tracker</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          style={{ flex: 1 }}
          placeholder="What are you working on?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button onClick={() => startEntry()}>Start Timer</button>
      </div>

      {entries.length === 0 ? (
        <p>No time entries yet. Start tracking your time!</p>
      ) : (
        <div>{renderEntries()}</div>
      )}
    </div>
  );
}
