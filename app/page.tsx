"use client";

import { useEffect, useState } from "react";
import { Check, X, Menu, Moon, Sun, Undo2, ArrowDown, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabase";

type List = { id: string; title: string; type: string; subtitle?: string; user_id: string };
type Task = { id: string; list_id: string; content: string; subtitle?: string; tags: string[]; completed: boolean; archived: boolean; user_id: string };

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [lists, setLists] = useState<List[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Input states
  const [addingTaskForList, setAddingTaskForList] = useState<string | null>(null);
  const [newTaskContent, setNewTaskContent] = useState("");

  const [addingListType, setAddingListType] = useState<string | null>(null);
  const [newListTitle, setNewListTitle] = useState("");

  const [editingSubtitle, setEditingSubtitle] = useState<string | null>(null);
  const [newSubtitle, setNewSubtitle] = useState("");

  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "dark" || (!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      setTheme("light");
      document.documentElement.setAttribute("data-theme", "light");
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) fetchData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchData(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const fetchData = async (userId: string) => {
    const [listsRes, tasksRes] = await Promise.all([
      supabase.from("lists").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("tasks").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    ]);

    if (listsRes.data) setLists(listsRes.data);
    if (tasksRes.data) setTasks(tasksRes.data);
  };

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel("schema-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchData(session.user.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "lists" }, () => fetchData(session.user.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const addTask = async (listId: string) => {
    if (!newTaskContent.trim() || !session) return;
    await supabase.from("tasks").insert({
      user_id: session.user.id,
      list_id: listId,
      content: newTaskContent,
      completed: false,
      archived: false,
    });
    setNewTaskContent("");
  };

  const addList = async (type: string) => {
    if (!newListTitle.trim() || !session) return;
    await supabase.from("lists").insert({
      user_id: session.user.id,
      title: newListTitle,
      type,
    });
    setAddingListType(null);
    setNewListTitle("");
  };

  const toggleTask = async (task: Task) => {
    await supabase.from("tasks").update({ completed: !task.completed }).eq("id", task.id);
  };

  const deleteTask = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
  };

  const saveSubtitle = async (task: Task) => {
    await supabase.from("tasks").update({ subtitle: newSubtitle }).eq("id", task.id);
    setEditingSubtitle(null);
  };

  const archiveList = async (id: string) => {
    await supabase.from("tasks").update({ archived: true }).eq("list_id", id);
  };

  if (loading) return <main className="container">Loading...</main>;

  if (!session) {
    return (
      <main className="container" style={{ textAlign: "center", marginTop: "10rem" }}>
        <h1 style={{ marginBottom: "2rem" }}>Task Tracker</h1>
        <button
          onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}` } })}
          style={{ padding: "0.75rem 1.5rem", border: "1px solid var(--c-border)", borderRadius: "4px" }}
        >
          Sign in with Google
        </button>
      </main>
    );
  }

  const activeEpics = lists.filter(l => l.type === 'epic');
  const activeSprints = lists.filter(l => l.type === 'sprint');
  const archivedTasks = tasks.filter(t => t.archived);

  return (
    <main className="container">
      {/* TOOLBAR */}
      <div className="toolbar">
        <button title="Undo" style={{ opacity: 0.25, cursor: 'not-allowed' }}>
          <Undo2 size={16} />
        </button>
        <button title="Sort">
          <ArrowDown size={14} /> new
        </button>
        <button onClick={toggleTheme} title="Toggle theme">
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button onClick={() => supabase.auth.signOut()} style={{ opacity: 0.5 }}>
          sign out
        </button>
      </div>

      {/* FILTER BAR (Static design placeholders) */}
      <div className="filter-bar">
        <button className="pill active">All</button>
        <button className="pill">Project 1</button>
        <button className="pill">Project 2</button>
        <button className="pill">Unassigned</button>
        <button className="pill-manage">manage</button>
      </div>

      {/* EPICS SECTION */}
      <div className="section-title">
        EPICS 
        <span className="add-btn" onClick={() => { setAddingListType('epic'); setNewListTitle(""); }}>+</span>
      </div>
      
      {addingListType === 'epic' && (
        <div style={{ marginBottom: 24 }}>
          <input 
            autoFocus type="text" className="input-ghost" value={newListTitle} 
            onChange={e => setNewListTitle(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && addList('epic')} 
            onBlur={() => setAddingListType(null)}
            placeholder="New Epic Title..."
          />
        </div>
      )}

      {activeEpics.map(epic => (
        <div key={epic.id} className="task-row" style={{ paddingLeft: 0, marginBottom: 16 }}>
          <div className="task-text">{epic.title}</div>
          <span className="project-tag">Project 1</span>
        </div>
      ))}

      {/* SPRINTS SECTION */}
      <div className="section-title" style={{ marginTop: 48 }}>
        SPRINTS 
        <span className="add-btn" onClick={() => { setAddingListType('sprint'); setNewListTitle(""); }}>+</span>
      </div>

      {addingListType === 'sprint' && (
        <div style={{ marginBottom: 24 }}>
          <input 
            autoFocus type="text" className="input-ghost" value={newListTitle} 
            onChange={e => setNewListTitle(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && addList('sprint')} 
            onBlur={() => setAddingListType(null)}
            placeholder="New Sprint Title..."
          />
        </div>
      )}

      {activeSprints.map(sprint => {
        const sprintTasks = tasks.filter(t => t.list_id === sprint.id && !t.archived);
        const completedCount = sprintTasks.filter(t => t.completed).length;
        const totalCount = sprintTasks.length;
        const progressPercent = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;
        const isDone = totalCount > 0 && completedCount === totalCount;

        return (
          <div className="sprint-card" key={sprint.id}>
            <div className="sprint-header">
              <div className="sprint-title">
                {sprint.title}
                <div className="progress-container">
                  <div className="progress-bar">
                    <div className={`progress-fill ${isDone ? 'done' : ''}`} style={{ width: `${progressPercent}%` }}></div>
                  </div>
                  <span className="sprint-count">{completedCount}/{totalCount}</span>
                </div>
              </div>
              <div className="sprint-actions">
                <button className="action-task" onClick={() => { setAddingTaskForList(sprint.id); setNewTaskContent(""); }}>+ task</button>
                <button className="action-archive" onClick={() => archiveList(sprint.id)}>archive</button>
                <button className="action-del"><X size={14}/></button>
              </div>
            </div>

            <div className="sprint-goal">
              <span>goal</span>
              {sprint.subtitle || <span style={{ opacity: 0.5, cursor: 'text' }} onClick={() => { setEditingSubtitle(sprint.id); setNewSubtitle(""); }}>test</span>}
              {editingSubtitle === sprint.id && (
                 <input 
                    autoFocus type="text" className="input-ghost" style={{ display: 'inline', width: 'auto', marginLeft: 8 }}
                    value={newSubtitle} onChange={e => setNewSubtitle(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && saveSubtitle({ id: sprint.id } as Task)}
                    onBlur={() => saveSubtitle({ id: sprint.id } as Task)}
                    placeholder="click to set..."
                  />
              )}
            </div>

            {sprintTasks.map((task, idx) => (
              <div className="task-row" key={task.id}>
                <div className={`circle ${task.completed ? 'checked' : ''}`} onClick={() => toggleTask(task)}>
                  {task.completed && <Check size={12} strokeWidth={3} />}
                </div>
                <div className={`task-text ${task.completed ? 'strike' : ''}`} onClick={() => toggleTask(task)}>
                  {task.content}
                </div>
                
                {/* Decorative Project Tags conditionally shown to match dummy layout if needed */}
                {idx % 2 === 1 && <span className="project-tag">Project 1</span>}

                <div className="hover-actions" style={{ marginLeft: 'auto' }}>
                  <button onClick={() => deleteTask(task.id)} className="action-del"><X size={14}/></button>
                </div>
              </div>
            ))}

            {addingTaskForList === sprint.id && (
              <div className="task-row">
                 <div className="circle" style={{opacity: 0.3}}></div>
                 <input 
                  autoFocus type="text" className="input-ghost"
                  value={newTaskContent} onChange={e => setNewTaskContent(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && addTask(sprint.id)}
                  onBlur={() => newTaskContent.trim() === "" && setAddingTaskForList(null)}
                  placeholder="new task"
                />
              </div>
            )}
          </div>
        );
      })}

      {/* ARCHIVE */}
      <div className="archive-section section-title" style={{ marginTop: 64, borderTop: 'none', paddingTop: 0 }}>
        <ChevronRight size={14} style={{ marginRight: 4 }} /> ARCHIVE
      </div>

    </main>
  );
}
