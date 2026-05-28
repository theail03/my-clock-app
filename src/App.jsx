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

  const withExportTimes = (entry) => ({
    ...entry,
    startTime: formatDateTime(entry.startTime),
    startTimeUtc: entry.startTime,
    ...(entry.endTime
      ? {
          endTime: formatDateTime(entry.endTime),
          endTimeUtc: entry.endTime,
        }
      : {}),
  });

  // --- NEW: Helper to gather system info automatically ---
  const getSystemInfo = () => {
    return {
      exportedAt: new Date().toLocaleString(),
      exportedAtUtc: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userAgent: navigator.userAgent, // Contains detailed Browser & OS info
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    };
  };

  const [title, setTitle] = useState("");
  
  // 1. Load entries
  const [entries, setEntries] = useState(() => {
    const stored = localStorage.getItem("timeEntries");
    return stored ? JSON.parse(stored) : [];
  });

  // 2. Load notes
  const [notes, setNotes] = useState(() => {
    return localStorage.getItem("globalNotes") || "";
  });

  const [creatingSub, setCreatingSub] = useState(null);
  const [subTitle, setSubTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [tagInputs, setTagInputs] = useState({});
  const [rangeStartDate, setRangeStartDate] = useState("");
  const [rangeEndDate, setRangeEndDate] = useState("");

  useEffect(() => {
    localStorage.setItem("timeEntries", JSON.stringify(entries));
  }, [entries]);

  // 3. Save notes when they change
  useEffect(() => {
    localStorage.setItem("globalNotes", notes);
  }, [notes]);

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

  useEffect(() => {
    const running = entries.filter((e) => e.running);
    if (running.length > 0) {
      const current = running.reduce((a, b) => (a.start > b.start ? a : b));
      document.title = `${formatTime(current.duration ?? 0)} • ${
        current.title
      } — Time Tracker`;
    } else {
      document.title = "Time Tracker";
    }
    return () => {
      document.title = "Time Tracker";
    };
  }, [entries]);

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
        tags: [],
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

  const addTagsToEntry = (id, tagsToAdd) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const currentTags = e.tags || [];
        const newTags = [];
        tagsToAdd.forEach((t) => {
          if (t && !currentTags.includes(t)) {
            newTags.push(t);
          }
        });
        return { ...e, tags: [...currentTags, ...newTags] };
      })
    );
  };

  const removeTagFromEntry = (id, tagToRemove) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              tags: (e.tags || []).filter((t) => t !== tagToRemove),
            }
          : e
      )
    );
  };

  const clearAllEntries = () => {
    if (entries.length === 0) return;
    const ok = window.confirm(
      "Delete ALL entries? This action cannot be undone."
    );
    if (!ok) return;
    setEntries([]);
  };

  const copyEntriesJson = async (selectedEntries, successMessage, extra = {}) => {
    const exportData = {
      ...extra,
      notes: notes,               // Your manual text
      systemInfo: getSystemInfo(), // Automatic browser/OS info
      entries: selectedEntries.map(withExportTimes), // The time data
    };
    
    const data = JSON.stringify(exportData, null, 2);
    try {
      await navigator.clipboard.writeText(data);
      alert(successMessage);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = data;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert(successMessage);
    }
  };

  // 4. Update Copy Logic to include Notes AND System Info
  const copyAllEntries = async () => {
    await copyEntriesJson(entries, "Entries, notes, and system info copied.");
  };

  const isSameLocalDate = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const copyTodayEntries = async () => {
    const today = new Date();
    const todayEntries = entries.filter((e) => {
      if (!e.startTime) return false;
      const d = new Date(e.startTime);
      return isSameLocalDate(d, today);
    });

    await copyEntriesJson(todayEntries, "Today's data (with notes & info) copied.");
  };

  const dateInputToLocalDate = (value, endOfDay = false) => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);
  };

  const copyRangeEntries = async () => {
    if (!rangeStartDate || !rangeEndDate) {
      alert("Choose a start and end date first.");
      return;
    }

    const rangeStart = dateInputToLocalDate(rangeStartDate);
    const rangeEnd = dateInputToLocalDate(rangeEndDate, true);

    if (rangeStart > rangeEnd) {
      alert("Start date must be before or equal to end date.");
      return;
    }

    const rangeEntries = entries.filter((e) => {
      if (!e.startTime) return false;
      const startedAt = new Date(e.startTime);
      return startedAt >= rangeStart && startedAt <= rangeEnd;
    });

    await copyEntriesJson(
      rangeEntries,
      `Entries from ${rangeStartDate} to ${rangeEndDate} copied.`,
      {
        range: {
          startDate: rangeStartDate,
          endDate: rangeEndDate,
          startDateLocal: rangeStart.toLocaleString(),
          endDateLocal: rangeEnd.toLocaleString(),
        },
      }
    );
  };

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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <strong>{e.title}</strong>
                  <button
                    onClick={() => {
                      setEditingId(e.id);
                      setEditingTitle(e.title);
                    }}
                  >
                    Edit
                  </button>

                  {(e.tags || []).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 10,
                        border: "1px solid #ccc",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTagFromEntry(e.id, tag)}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          fontSize: 10,
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  <input
                    style={{
                      fontSize: 10,
                      padding: "2px 4px",
                      minWidth: 80,
                    }}
                    placeholder="tags (comma)"
                    value={tagInputs[e.id] || ""}
                    onChange={(ev) =>
                      setTagInputs((prev) => ({
                        ...prev,
                        [e.id]: ev.target.value,
                      }))
                    }
                  />
                  <button
                    style={{ fontSize: 10, padding: "2px 6px" }}
                    onClick={() => {
                      const raw = (tagInputs[e.id] || "").trim();
                      if (!raw) return;
                      const tags = raw
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean);
                      if (tags.length === 0) return;
                      addTagsToEntry(e.id, tags);
                      setTagInputs((prev) => ({ ...prev, [e.id]: "" }));
                    }}
                  >
                    Add
                  </button>
                </div>
              )}

              <div>
                ⏱ {formatTime(e.duration)} {e.running && "🟢"}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#333",
                  backgroundColor: "#f0f0f0",
                  padding: "2px 4px",
                  borderRadius: "4px",
                  marginTop: 4,
                }}
              >
                Start: {formatDateTime(e.startTime)}
                {e.endTime && <> | End: {formatDateTime(e.endTime)}</>}
              </div>
            </div>

            {e.running && <button onClick={() => stopEntry(e.id)}>Stop</button>}
            <button onClick={() => setCreatingSub(e.id)}>Add Sub</button>
            <button onClick={() => deleteEntry(e.id)}>Delete</button>
          </div>

          {creatingSub === e.id && (
            <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
              <input
                style={{ flex: 1 }}
                placeholder="Sub-entry title"
                value={subTitle}
                onChange={(ev) => setSubTitle(ev.target.value)}
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
    <div className="container">
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

      {/* 5. Notes Section */}
      <div style={{ marginTop: 32 }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
          Session Notes:
        </label>
        <textarea
          style={{
            width: "100%",
            height: "80px",
            padding: "8px",
            boxSizing: "border-box",
            marginBottom: "16px",
          }}
          placeholder="Type any manual notes here (ticket numbers, user name, etc.)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="export-panel">
        <div className="export-header">
          <div>
            <h2>Export JSON</h2>
            <p>Copy all entries, today, or a custom local date range.</p>
          </div>
          <button className="danger-button" onClick={clearAllEntries}>
            Delete all entries
          </button>
        </div>

        <div className="export-actions">
          <button onClick={copyAllEntries}>All entries</button>
          <button onClick={copyTodayEntries}>Today</button>
        </div>

        <div className="range-export">
          <label>
            <span>From</span>
            <input
              type="date"
              value={rangeStartDate}
              onChange={(e) => setRangeStartDate(e.target.value)}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={rangeEndDate}
              onChange={(e) => setRangeEndDate(e.target.value)}
            />
          </label>
          <button onClick={copyRangeEntries}>Copy range</button>
        </div>
      </div>
    </div>
  );
}
