import { useState, useEffect, useRef } from "react";
import "./App.css";

export default function App() {
  const formatTime = (ms) => {
    const sec = Math.floor(ms / 1000);
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const formatDateTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const [title, setTitle] = useState("");
  const [entries, setEntries] = useState(() => {
    const stored = localStorage.getItem("timeEntries");
    return stored ? JSON.parse(stored) : [];
  });
  const [creatingSub, setCreatingSub] = useState(null);
  const [subTitle, setSubTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    localStorage.setItem("timeEntries", JSON.stringify(entries));
  }, [entries]);

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

  const startEntry = (customTitle, parentId = null) => {
    const now = Date.now();
    const entryTitle = customTitle.trim();
    if (!entryTitle) return;

    setEntries((prev) => [
      ...prev,
      {
        id: now,
        parentId,
        title: entryTitle,
        start: now,
        startTime: new Date(now).toISOString(),
        duration: 0,
        running: true,
      },
    ]);
  };

  const stopEntry = (id) =>
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              running: false,
              endTime: new Date().toISOString(),
            }
          : e
      )
    );

  const deleteEntry = (id) =>
    setEntries((prev) => {
      const idsToDelete = new Set();
      const collect = (pid) => {
        idsToDelete.add(pid);
        prev.forEach((e) => {
          if (e.parentId === pid) collect(e.id);
        });
      };
      collect(id);
      return prev.filter((e) => !idsToDelete.has(e.id));
    });

  const updateTitle = (id, newTitle) =>
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, title: newTitle } : e))
    );

  const renderEntries = (parentId = null, level = 0) =>
    [...entries]
      .reverse()
      .filter((e) => e.parentId === parentId)
      .map((e) => (
        <div
          key={e.id}
          style={{
            marginLeft: level * 20,
            padding: "10px 0",
            borderBottom: "1px solid #333",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1 }}>
              {editingId === e.id ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    style={{ fontWeight: "bold", flex: 1 }}
                    value={editingTitle}
                    onChange={(ev) => setEditingTitle(ev.target.value)}
                  />
                  <button
                    onClick={() => {
                      updateTitle(e.id, editingTitle);
                      setEditingId(null);
                      setEditingTitle("");
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditingTitle("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <strong>{e.title}</strong>
                  <button
                    onClick={() => {
                      setEditingId(e.id);
                      setEditingTitle(e.title);
                    }}
                    style={{ marginLeft: 6 }}
                  >
                    Edit
                  </button>
                </>
              )}
              <div>
                ⏱ {formatTime(e.duration)} {e.running && "🟢"}
              </div>
              <div style={{ fontSize: 12, color: "#aaa" }}>
                Start: {formatDateTime(e.startTime)}
                {e.endTime && <> | End: {formatDateTime(e.endTime)}</>}
              </div>
            </div>
            {e.running && (
              <button onClick={() => stopEntry(e.id)}>Stop</button>
            )}
            <button onClick={() => setCreatingSub(e.id)}>Add Sub</button>
            <button onClick={() => deleteEntry(e.id)}>Delete</button>
          </div>

          {creatingSub === e.id && (
            <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
              <input
                style={{ flex: 1 }}
                placeholder="Sub-entry title"
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
              />
              <button
                onClick={() => {
                  startEntry(subTitle, e.id);
                  setSubTitle("");
                  setCreatingSub(null);
                }}
              >
                Start
              </button>
              <button onClick={() => setCreatingSub(null)}>Cancel</button>
            </div>
          )}

          {renderEntries(e.id, level + 1)}
        </div>
      ));

  return (
    <div
      className="container"
      style={{ maxWidth: 700, margin: "0 auto", padding: 24, textAlign: "left" }}
    >
      <h1 style={{ textAlign: "center", marginBottom: 24 }}>Time Tracker</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          style={{ flex: 1 }}
          placeholder="What are you working on?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          onClick={() => {
            startEntry(title);
            setTitle("");
          }}
        >
          Start Timer
        </button>
      </div>

      {entries.length === 0 ? (
        <p style={{ textAlign: "center" }}>
          No time entries yet. Start tracking your time!
        </p>
      ) : (
        <div>{renderEntries()}</div>
      )}
    </div>
  );
}
