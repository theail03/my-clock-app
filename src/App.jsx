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

  const getEffectiveStartTime = (entry) =>
    entry.editedStartTime || entry.startTime;

  const getEffectiveEndTime = (entry) => entry.editedEndTime || entry.endTime;

  const getEntryDuration = (entry) => {
    const start = new Date(getEffectiveStartTime(entry)).getTime();
    const end = entry.running
      ? Date.now()
      : new Date(getEffectiveEndTime(entry)).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return entry.duration ?? 0;
    }
    return end - start;
  };

  const toDateTimeLocalValue = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const offsetMs = d.getTimezoneOffset() * 60 * 1000;
    return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
  };

  const dateTimeLocalToIso = (value) => {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  };

  const withExportTimes = (entry) => {
    const startTimeUtc = getEffectiveStartTime(entry);
    const endTimeUtc = getEffectiveEndTime(entry);
    const timeEdited = Boolean(entry.editedStartTime || entry.editedEndTime);
    const {
      startTime: _startTime,
      endTime: _endTime,
      editedStartTime: _editedStartTime,
      editedEndTime: _editedEndTime,
      duration: _duration,
      ...rest
    } = entry;

    return {
      ...rest,
      duration: getEntryDuration(entry),
      timeEdited,
      startTime: formatDateTime(startTimeUtc),
      startTimeUtc,
      originalStartTime: formatDateTime(entry.startTime),
      originalStartTimeUtc: entry.startTime,
      ...(endTimeUtc
        ? {
            endTime: formatDateTime(endTimeUtc),
            endTimeUtc,
          }
        : {}),
      ...(entry.endTime
        ? {
            originalEndTime: formatDateTime(entry.endTime),
            originalEndTimeUtc: entry.endTime,
          }
        : {}),
    };
  };

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
  const [editingTimeId, setEditingTimeId] = useState(null);
  const [timeDraft, setTimeDraft] = useState({ start: "", end: "" });
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

  const startEditingTime = (entry) => {
    setEditingTimeId(entry.id);
    setTimeDraft({
      start: toDateTimeLocalValue(getEffectiveStartTime(entry)),
      end: toDateTimeLocalValue(getEffectiveEndTime(entry)),
    });
  };

  const cancelEditingTime = () => {
    setEditingTimeId(null);
    setTimeDraft({ start: "", end: "" });
  };

  const saveEditedTime = (entry) => {
    const editedStartTime = dateTimeLocalToIso(timeDraft.start);
    const editedEndTime = dateTimeLocalToIso(timeDraft.end);

    if (!editedStartTime) {
      alert("Choose a start time.");
      return;
    }

    if (!entry.running && !editedEndTime) {
      alert("Choose an end time.");
      return;
    }

    if (
      editedEndTime &&
      new Date(editedEndTime).getTime() < new Date(editedStartTime).getTime()
    ) {
      alert("End time must be after start time.");
      return;
    }

    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id
          ? {
              ...e,
              editedStartTime,
              editedEndTime: editedEndTime || undefined,
            }
          : e
      )
    );
    cancelEditingTime();
  };

  const resetEditedTime = (id) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, editedStartTime: undefined, editedEndTime: undefined }
          : e
      )
    );
    cancelEditingTime();
  };

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
      const startTime = getEffectiveStartTime(e);
      if (!startTime) return false;
      const d = new Date(startTime);
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
      const startTime = getEffectiveStartTime(e);
      if (!startTime) return false;
      const startedAt = new Date(startTime);
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
                ⏱ {formatTime(getEntryDuration(e))} {e.running && "🟢"}
              </div>
              {editingTimeId === e.id ? (
                <div className="time-editor">
                  <label>
                    <span>Start</span>
                    <input
                      type="datetime-local"
                      value={timeDraft.start}
                      onChange={(ev) =>
                        setTimeDraft((prev) => ({
                          ...prev,
                          start: ev.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>End</span>
                    <input
                      type="datetime-local"
                      value={timeDraft.end}
                      disabled={e.running}
                      onChange={(ev) =>
                        setTimeDraft((prev) => ({
                          ...prev,
                          end: ev.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="time-editor-actions">
                    <button onClick={() => saveEditedTime(e)}>Save time</button>
                    <button onClick={cancelEditingTime}>Cancel</button>
                    <button onClick={() => resetEditedTime(e.id)}>
                      Reset to original
                    </button>
                  </div>
                </div>
              ) : (
                <div className="time-details">
                  {(e.editedStartTime || e.editedEndTime) && (
                    <div className="time-row time-row-edited">
                      <span className="time-label">Edited</span>
                      <span>
                        Start: {formatDateTime(getEffectiveStartTime(e))}
                        {getEffectiveEndTime(e) && (
                          <> | End: {formatDateTime(getEffectiveEndTime(e))}</>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="time-row">
                    <span className="time-label">Original</span>
                    <span>
                      Start: {formatDateTime(e.startTime)}
                      {e.endTime && <> | End: {formatDateTime(e.endTime)}</>}
                    </span>
                  </div>
                  <button
                    className="small-button"
                    onClick={() => startEditingTime(e)}
                  >
                    Edit time
                  </button>
                </div>
              )}
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
