"use client";

import { useEffect, useState } from "react";
import { Check, X, ArrowRight, CornerDownRight, Menu, Moon, Sun } from "lucide-react";
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
    // Initial theme check
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
    // Intentionally NOT setting addingTaskForList to null to allow continuous typing
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
          onClick={() => supabase.auth.signInWithOAuth({ provider: "google" })}
          style={{ padding: "0.75rem 1.5rem", backgroundColor: "var(--text-color)", color: "var(--bg-color)", borderRadius: "4px", fontWeight: "bold" }}
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
      {/* FIXED STATIC HEADER */}
      <div className="fixed-header">
        <button onClick={toggleTheme} title="Toggle theme">
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button onClick={() => supabase.auth.signOut()} className="title-action-green" style={{ margin: 0 }}>
          sign out
        </button>
      </div>

      {/* EPICS */}
      <h2 className="list-title" style={{ marginTop: '2rem' }}>Epics</h2>
      {activeEpics.map(epic => {
        const epicTasks = tasks.filter(t => t.list_id === epic.id && !t.archived);
        return (
          <section className="list-section" key={epic.id}>
            <div className="task-subtitle" style={{ color: 'var(--text-color)' }}>{epic.title}</div>
            {epicTasks.map(task => (
              <div key={task.id} style={{ marginBottom: "1rem" }}>
                <div className={`task-row ${task.completed ? 'completed' : ''}`} style={{ marginBottom: 0 }}>
                   <div className="task-content">
                    {task.completed ? (
                      <Check className="icon icon-green" size={14} style={{ marginRight: '6px' }} />
                    ) : (
                      <div className="empty-circle"></div>
                    )}
                    <span className="task-bullet">-</span> 
                    <span className={task.completed ? "text-strike" : ""} onClick={() => toggleTask(task)} style={{ cursor: 'pointer' }}>
                      {task.content}
                    </span>
                  </div>
                  <div className="task-actions hover-actions">
                    <Check className="icon icon-green" size={14} onClick={() => toggleTask(task)} />
                    <Menu className="icon" size={14} onClick={() => { setEditingSubtitle(task.id); setNewSubtitle(task.subtitle || ""); }} />
                    <X className="icon" size={14} onClick={() => deleteTask(task.id)} />
                  </div>
                </div>
                {/* Description Block */}
                {editingSubtitle === task.id ? (
                  <input 
                    autoFocus 
                    type="text" 
                    value={newSubtitle} 
                    onChange={e => setNewSubtitle(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && saveSubtitle(task)}
                    onBlur={() => saveSubtitle(task)}
                    style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '0.85rem', width: '100%', marginLeft: '1.5rem', opacity: 0.8 }}
                    placeholder="Add description..."
                  />
                ) : task.subtitle ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '1.5rem', opacity: 0.8 }} onClick={() => { setEditingSubtitle(task.id); setNewSubtitle(task.subtitle || ""); }}>
                    {task.subtitle}
                  </div>
                ) : null}
              </div>
            ))}
            {addingTaskForList === epic.id ? (
              <div className="task-row">
                <input 
                  autoFocus 
                  type="text" 
                  value={newTaskContent} 
                  onChange={e => setNewTaskContent(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && addTask(epic.id)}
                  onBlur={() => newTaskContent.trim() === "" && setAddingTaskForList(null)}
                  style={{ background: 'transparent', color: 'inherit', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 'inherit', width: '100%' }}
                  placeholder="Task content..."
                />
              </div>
            ) : (
             <div className="task-add" onClick={() => { setAddingTaskForList(epic.id); setNewTaskContent(""); }}>
                <span className="add-plus">+</span> add task
             </div>
            )}
          </section>
        );
      })}

      {addingListType === 'epic' ? (
        <input 
          autoFocus type="text" value={newListTitle} onChange={e => setNewListTitle(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && addList('epic')} onBlur={() => setAddingListType(null)}
          style={{ background: 'transparent', color: 'inherit', border: '1px solid var(--border-color)', outline: 'none', padding: '4px' }}
          placeholder="New Epic Title"
        />
      ) : (
        <div className="task-add sprint-add" onClick={() => { setAddingListType('epic'); setNewListTitle(""); }}>
          <span className="add-plus">+</span> add epic
        </div>
      )}

      {/* SPRINTS */}
      <hr className="divider" style={{ borderTop: '0px' }} />
      {activeSprints.map(sprint => {
        const sprintTasks = tasks.filter(t => t.list_id === sprint.id && !t.archived);
        const completedCount = sprintTasks.filter(t => t.completed).length;
        
        return (
          <section className="list-section" key={sprint.id}>
            <h2 className="list-title">
              {sprint.title} <span className="title-count">{completedCount}/{sprintTasks.length}</span>
              <Menu className="icon title-icon" size={14} />
              <Check className="icon icon-green title-icon" size={14} />
              <span className="title-action-green" onClick={() => archiveList(sprint.id)}>archive</span>
            </h2>
            {sprint.subtitle && <div className="task-subtitle">{sprint.subtitle}</div>}

            {sprintTasks.map(task => (
              <div key={task.id} style={{ marginBottom: "1rem" }}>
                <div className={`task-row ${task.completed ? 'completed' : ''}`} style={{ marginBottom: 0 }}>
                  <div className="task-content">
                    {task.completed ? (
                      <Check className="icon icon-green" size={14} style={{ marginRight: '6px' }} />
                    ) : (
                      <div className="empty-circle"></div>
                    )}
                    <span className="task-bullet">-</span> 
                    <span className={task.completed ? "text-strike" : ""} onClick={() => toggleTask(task)} style={{ cursor: 'pointer' }}>
                      {task.content}
                    </span>
                  </div>
                  <div className="task-actions hover-actions">
                    <Check className="icon icon-green" size={14} onClick={() => toggleTask(task)} />
                    <Menu className="icon" size={14} onClick={() => { setEditingSubtitle(task.id); setNewSubtitle(task.subtitle || ""); }} />
                    <X className="icon" size={14} onClick={() => deleteTask(task.id)} />
                  </div>
                </div>
                {/* Description Block */}
                {editingSubtitle === task.id ? (
                  <input 
                    autoFocus 
                    type="text" 
                    value={newSubtitle} 
                    onChange={e => setNewSubtitle(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && saveSubtitle(task)}
                    onBlur={() => saveSubtitle(task)}
                    style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '0.85rem', width: '100%', marginLeft: '1.5rem', opacity: 0.8 }}
                    placeholder="Add description..."
                  />
                ) : task.subtitle ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '1.5rem', opacity: 0.8 }} onClick={() => { setEditingSubtitle(task.id); setNewSubtitle(task.subtitle || ""); }}>
                    {task.subtitle}
                  </div>
                ) : null}
              </div>
            ))}

            {addingTaskForList === sprint.id ? (
              <div className="task-row">
                <input 
                  autoFocus 
                  type="text" 
                  value={newTaskContent} 
                  onChange={e => setNewTaskContent(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && addTask(sprint.id)}
                  onBlur={() => newTaskContent.trim() === "" && setAddingTaskForList(null)}
                  style={{ background: 'transparent', color: 'inherit', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 'inherit', width: '100%' }}
                  placeholder="Task content..."
                />
              </div>
            ) : (
             <div className="task-add" onClick={() => { setAddingTaskForList(sprint.id); setNewTaskContent(""); }}>
                <span className="add-plus">+</span> add task
             </div>
            )}
          </section>
        );
      })}

      {addingListType === 'sprint' ? (
        <input 
          autoFocus type="text" value={newListTitle} onChange={e => setNewListTitle(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && addList('sprint')} onBlur={() => setAddingListType(null)}
          style={{ background: 'transparent', color: 'inherit', border: '1px solid var(--border-color)', outline: 'none', padding: '4px' }}
          placeholder="New Sprint Title"
        />
      ) : (
        <div className="task-add sprint-add" onClick={() => { setAddingListType('sprint'); setNewListTitle(""); }}>
          <span className="add-plus">+</span> add sprint
        </div>
      )}

      <hr className="divider" />

      {/* ARCHIVE */}
      <section className="list-section archive-section">
        <h2 className="list-title">
          Archive <span className="arrow-down">▼</span> <span className="title-count">{archivedTasks.length}</span>
        </h2>

        {archivedTasks.map(task => (
          <div className="task-row archive-item" key={task.id}>
            <div className="task-content">
              <CornerDownRight className="icon" size={14} style={{ marginRight: '6px' }} />
              <span className="task-bullet">-</span> 
              <span className="text-strike">{task.content}</span>
              <X className="icon title-icon" size={14} style={{ marginLeft: '8px' }} onClick={() => deleteTask(task.id)} />
            </div>
          </div>
        ))}
      </section>

    </main>
  );
}
