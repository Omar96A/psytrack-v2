import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import supabase from "./supabaseClient";

// ─── STORAGE HELPERS ────────────────────────────────────────────────────────
const load = async (key, shared = false) => {
  try {
    const raw = localStorage.getItem(key);
    return raw != null ? JSON.parse(raw) : null;
  } catch { return null; }
};
const save = async (key, val, shared = false) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
};

// ─── ASSESSMENT DEFINITIONS ──────────────────────────────────────────────────
const GAD7 = {
  id: "gad7", label: "GAD-7", color: "#6EE7B7",
  timeframe: "Over the last 2 weeks",
  instruction: "How often have you been bothered by the following problems?",
  questions: [
    "Feeling nervous, anxious, or on edge",
    "Not being able to stop or control worrying",
    "Worrying too much about different things",
    "Trouble relaxing",
    "Being so restless that it is hard to sit still",
    "Becoming easily annoyed or irritable",
    "Feeling afraid, as if something awful might happen",
  ],
  options: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
  maxScore: 21,
  severity: (s) => s <= 4 ? { label: "Minimal", color: "#4ade80" } : s <= 9 ? { label: "Mild", color: "#facc15" } : s <= 14 ? { label: "Moderate", color: "#fb923c" } : { label: "Severe", color: "#f87171" },
};

const PHQ9 = {
  id: "phq9", label: "PHQ-9", color: "#93C5FD",
  timeframe: "Over the last 2 weeks",
  instruction: "How often have you been bothered by any of the following problems?",
  questions: [
    "Little interest or pleasure in doing things",
    "Feeling down, depressed, or hopeless",
    "Trouble falling or staying asleep, or sleeping too much",
    "Feeling tired or having little energy",
    "Poor appetite or overeating",
    "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
    "Trouble concentrating on things, such as reading the newspaper or watching television",
    "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless",
    "Thoughts that you would be better off dead, or of hurting yourself in some way",
  ],
  options: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
  maxScore: 27,
  severity: (s) => s <= 4 ? { label: "Minimal", color: "#4ade80" } : s <= 9 ? { label: "Mild", color: "#facc15" } : s <= 14 ? { label: "Moderate", color: "#fb923c" } : s <= 19 ? { label: "Moderately Severe", color: "#f97316" } : { label: "Severe", color: "#f87171" },
};

const ASSIST = {
  id: "assist", label: "ASSIST", color: "#C4B5FD",
  timeframe: "In the past 3 months",
  instruction: "How often have you used the following substances?",
  questions: [
    "Tobacco products (cigarettes, chewing tobacco, cigars, etc.)",
    "Alcoholic beverages (beer, wine, spirits, etc.)",
    "Cannabis (marijuana, pot, grass, hash, etc.)",
    "Cocaine (coke, crack, etc.)",
    "Amphetamine-type stimulants (speed, diet pills, ecstasy, etc.)",
    "Inhalants (nitrous, glue, petrol, paint thinner, etc.)",
    "Sedatives or sleeping pills (Valium, Serepax, Rohypnol, etc.)",
    "Hallucinogens (LSD, acid, mushrooms, PCP, etc.)",
    "Opioids (heroin, morphine, methadone, codeine, etc.)",
    "Other — please specify",
  ],
  options: ["Never", "Once or twice", "Monthly", "Weekly", "Daily or almost daily"],
  maxScore: 60,
  severity: (s) => s <= 3 ? { label: "Low Risk", color: "#4ade80" } : s <= 26 ? { label: "Moderate Risk", color: "#facc15" } : { label: "High Risk", color: "#f87171" },
};

const AUDITC = {
  id: "auditc", label: "AUDIT-C", color: "#FCA5A5",
  timeframe: "Over the past year",
  instruction: "Please answer the following questions about your alcohol use.",
  questions: [
    "How often do you have a drink containing alcohol?",
    "How many standard drinks containing alcohol do you have on a typical day when drinking?",
    "How often do you have 6 or more drinks on one occasion?",
  ],
  options: [["Never", "Monthly or less", "2-4 times/month", "2-3 times/week", "4+ times/week"],
             ["1-2 drinks", "3-4 drinks", "5-6 drinks", "7-9 drinks", "10+ drinks"],
             ["Never", "Less than monthly", "Monthly", "Weekly", "Daily or almost daily"]],
  maxScore: 12,
  severity: (s) => s <= 2 ? { label: "Low Risk", color: "#4ade80" } : s <= 7 ? { label: "Moderate Risk", color: "#facc15" } : { label: "High Risk", color: "#f87171" },
};

const QIDSSR = {
  id: "qidssr", label: "QIDS-SR", color: "#FDE68A",
  timeframe: "Over the last 7 days",
  instruction: "Please rate each item that best describes you for the past 7 days.",
  questions: [
    "Sleep onset insomnia",
    "Mid-nocturnal insomnia",
    "Early morning insomnia",
    "Hypersomnia",
    "Sad mood",
    "Decreased appetite",
    "Increased appetite",
    "Decreased weight",
    "Increased weight",
    "Concentration/decision making",
    "View of myself",
    "Thoughts of death or suicide",
    "General interest",
    "Energy/fatigability",
    "Psychomotor slowing",
    "Psychomotor agitation",
  ],
  options: ["Never / Not at all", "Rarely / Slightly", "Sometimes / Moderately", "Most of the time / Severely"],
  maxScore: 27,
  severity: (s) => s <= 5 ? { label: "Normal", color: "#4ade80" } : s <= 10 ? { label: "Mild", color: "#facc15" } : s <= 15 ? { label: "Moderate", color: "#fb923c" } : s <= 20 ? { label: "Severe", color: "#f97316" } : { label: "Very Severe", color: "#f87171" },
};

const ASSESSMENTS = { gad7: GAD7, phq9: PHQ9, assist: ASSIST, auditc: AUDITC, qidssr: QIDSSR };

// ─── STYLES ──────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── CLINICIAN THEME (default) ── */
  :root {
    --bg: #0D1117;
    --surface: #161B22;
    --surface2: #1C2330;
    --surface3: #21293A;
    --border: #2A3548;
    --border-bright: #3A4F6B;
    --text: #E6EDF3;
    --text-soft: #CDD9E5;
    --muted: #7D8FA8;
    --accent: #2DD4BF;
    --accent-dark: #0F9488;
    --accent2: #F59E0B;
    --accent2-dark: #B45309;
    --blue: #3B82F6;
    --danger: #F87171;
    --warn: #FBBF24;
    --success: #34D399;
    --nav-bg: #0D1117;
    --font-display: 'DM Serif Display', serif;
    --font-body: 'DM Sans', sans-serif;
  }

  /* ── PATIENT THEME (scoped) ── */
  .patient-theme {
    --bg: #F8FAFC;
    --surface: #FFFFFF;
    --surface2: #F1F5F9;
    --surface3: #E2E8F0;
    --border: #CBD5E1;
    --border-bright: #94A3B8;
    --text: #0F172A;
    --text-soft: #1E293B;
    --muted: #64748B;
    --accent: #1D4ED8;
    --accent-dark: #1e3a8a;
    --accent2: #059669;
    --nav-bg: #FFFFFF;
    --font-display: 'DM Serif Display', serif;
    --font-body: 'DM Sans', sans-serif;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font-body); min-height: 100vh; transition: background 0.3s;
    display: flex; flex-direction: column; align-items: center; }
  .app { min-height: 100vh; display: flex; flex-direction: column; width: 100%; max-width: 1280px; margin: 0 auto; }

  /* NAV */
  .nav { display: flex; align-items: center; justify-content: space-between; padding: 0.875rem 2rem;
    border-bottom: 1px solid var(--border); background: var(--nav-bg); position: sticky; top: 0; z-index: 100;
    box-shadow: 0 1px 0 var(--border); }
  .logo { font-family: var(--font-display); font-size: 1.6rem; letter-spacing: -0.5px;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .nav-tabs { display: flex; gap: 0.4rem; background: var(--surface2); padding: 0.25rem; border-radius: 10px; border: 1px solid var(--border); }
  .nav-tab { padding: 0.45rem 1.1rem; border-radius: 7px; border: none; cursor: pointer;
    font-size: 0.84rem; font-weight: 500; transition: all 0.2s; background: transparent; color: var(--muted); font-family: var(--font-body); }
  .nav-tab.active { background: var(--accent); color: #0D1117; font-weight: 600; box-shadow: 0 2px 8px rgba(45,212,191,0.3); }
  .nav-tab:hover:not(.active) { color: var(--text); background: var(--surface3); }
  .patient-theme .nav-tab.active { background: var(--accent); color: #FFFFFF; box-shadow: 0 2px 8px rgba(29,78,216,0.25); }

  /* LAYOUT */
  .main { flex: 1; padding: 2rem; max-width: 1200px; margin: 0 auto; width: 100%; }
  .page-title { font-family: var(--font-display); font-size: 2rem; margin-bottom: 0.4rem; color: var(--text); }
  .page-sub { color: var(--muted); font-size: 0.875rem; margin-bottom: 2rem; }

  /* CLINICIAN HEADER BANNER */
  .dash-header { background: linear-gradient(135deg, #0F2744 0%, #0D2035 50%, #0A1628 100%);
    border: 1px solid var(--border); border-radius: 14px; padding: 1.8rem 2rem; margin-bottom: 1.75rem;
    position: relative; overflow: hidden; }
  .dash-header::before { content: ''; position: absolute; top: -40px; right: -40px; width: 220px; height: 220px;
    background: radial-gradient(circle, rgba(45,212,191,0.12) 0%, transparent 70%); pointer-events: none; }
  .dash-header::after { content: ''; position: absolute; bottom: -60px; left: 20%; width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%); pointer-events: none; }

  /* CARDS */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; }
  .card-sm { padding: 1rem; }
  .card-title { font-weight: 600; font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 1rem; }

  /* STAT BOXES — clinician */
  .stat-box { padding: 1.3rem 1.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    position: relative; overflow: hidden; transition: border-color 0.2s, transform 0.15s; }
  .stat-box:hover { border-color: var(--border-bright); transform: translateY(-1px); }
  .stat-box-accent { border-left: 3px solid var(--accent); }
  .stat-box-warn  { border-left: 3px solid var(--warn); }
  .stat-box-danger{ border-left: 3px solid var(--danger); }
  .stat-box-blue  { border-left: 3px solid var(--blue); }
  .stat-val { font-family: var(--font-display); font-size: 2.2rem; line-height: 1; margin-bottom: 0.3rem; }
  .stat-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; font-weight: 500; }
  .stat-glow { position: absolute; top: 0; right: 0; width: 80px; height: 80px; border-radius: 50%;
    opacity: 0.08; transform: translate(20px, -20px); }

  /* GRID */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }

  /* BUTTONS */
  .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1.2rem; border-radius: 8px;
    font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; font-family: var(--font-body); }
  .btn-primary { background: var(--accent); color: #0D1117; font-weight: 600; }
  .btn-primary:hover { background: #5EEAD4; box-shadow: 0 0 16px rgba(45,212,191,0.3); }
  .btn-primary:disabled { background: var(--border); color: var(--muted); cursor: not-allowed; box-shadow: none; }
  .btn-secondary { background: var(--surface2); color: var(--text-soft); border: 1px solid var(--border); }
  .btn-secondary:hover { border-color: var(--accent); color: var(--accent); background: rgba(45,212,191,0.06); }
  .btn-danger { background: rgba(248,113,113,0.1); color: var(--danger); border: 1px solid rgba(248,113,113,0.25); }
  .btn-success { background: rgba(52,211,153,0.1); color: var(--success); border: 1px solid rgba(52,211,153,0.25); }
  .btn-success:hover { background: rgba(52,211,153,0.18); }
  .btn-sm { padding: 0.35rem 0.8rem; font-size: 0.8rem; }
  .btn-full { width: 100%; justify-content: center; }
  .patient-theme .btn-primary { background: var(--accent); color: #FFFFFF; }
  .patient-theme .btn-primary:hover { background: #1e40af; box-shadow: 0 0 12px rgba(29,78,216,0.25); }
  .patient-theme .btn-primary:disabled { background: #93C5FD; color: #FFFFFF; box-shadow: none; }
  .patient-theme .btn-secondary { background: #FFFFFF; color: var(--text); border: 1px solid var(--border); }
  .patient-theme .btn-secondary:hover { border-color: var(--accent); color: var(--accent); background: #EFF6FF; }
  .patient-theme .btn-success { background: #ECFDF5; color: var(--accent2); border: 1px solid #A7F3D0; }

  /* INPUTS */
  .input { background: var(--surface2); border: 1px solid var(--border); color: var(--text); padding: 0.6rem 0.9rem;
    border-radius: 8px; font-size: 0.875rem; font-family: var(--font-body); width: 100%; outline: none; }
  .input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(45,212,191,0.12); }
  .patient-theme .input { background: #FFFFFF; }
  .patient-theme .input:focus { box-shadow: 0 0 0 3px rgba(29,78,216,0.1); }
  .textarea { resize: vertical; min-height: 80px; }
  .label { font-size: 0.8rem; font-weight: 500; color: var(--muted); margin-bottom: 0.4rem; display: block; }
  .form-group { display: flex; flex-direction: column; margin-bottom: 1rem; }

  /* BADGE */
  .badge { display: inline-flex; align-items: center; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }

  /* PATIENT LIST */
  .patient-row { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.2rem;
    border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s; }
  .patient-row:last-child { border-bottom: none; }
  .patient-row:hover { background: var(--surface2); }
  .patient-row.active { background: rgba(45,212,191,0.06); border-left: 3px solid var(--accent); padding-left: calc(1.2rem - 3px); }
  .patient-name { font-weight: 600; margin-bottom: 0.2rem; color: var(--text); }
  .patient-meta { font-size: 0.8rem; color: var(--muted); }

  /* ASSESSMENT FORM — patient-facing */
  .q-item { padding: 1.4rem 0; border-bottom: 1px solid var(--border); }
  .q-item:last-child { border-bottom: none; }
  .q-text { font-size: 1rem; margin-bottom: 1rem; line-height: 1.6; color: var(--text); font-weight: 500; }
  .q-options { display: flex; flex-direction: column; gap: 0.5rem; }
  .q-option { padding: 0.75rem 1.1rem; border-radius: 8px; border: 1.5px solid var(--border);
    cursor: pointer; font-size: 0.9rem; transition: all 0.15s; background: var(--surface); color: var(--text);
    text-align: left; font-family: var(--font-body); font-weight: 400; }
  .patient-theme .q-option { background: #FFFFFF; }
  .patient-theme .q-option:hover { border-color: var(--accent); background: #EFF6FF; color: var(--accent); }
  .patient-theme .q-option.selected { border-color: var(--accent); background: var(--accent); color: #FFFFFF; font-weight: 500; }

  /* CHART */
  .chart-wrap { height: 280px; margin-top: 1rem; }
  .filter-pills { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
  .filter-pill { padding: 0.3rem 0.9rem; border-radius: 20px; border: 1.5px solid var(--border);
    font-size: 0.78rem; cursor: pointer; transition: all 0.2s; color: var(--muted); background: transparent; font-family: var(--font-body); }
  .filter-pill.active { color: #0D1117; font-weight: 600; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
  .filter-pill:hover:not(.active) { border-color: var(--accent); color: var(--accent); }

  /* TIMELINE */
  .timeline { position: relative; }
  .timeline::before { content: ''; position: absolute; left: 16px; top: 0; bottom: 0; width: 2px;
    background: linear-gradient(to bottom, var(--accent), var(--border)); opacity: 0.4; }
  .tl-item { position: relative; padding-left: 44px; padding-bottom: 1.5rem; }
  .tl-dot { position: absolute; left: 8px; top: 4px; width: 18px; height: 18px; border-radius: 50%;
    border: 3px solid var(--surface); box-shadow: 0 0 0 2px var(--border), 0 0 8px rgba(45,212,191,0.2); }
  .tl-date { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.4rem; font-weight: 600; letter-spacing: 0.3px; }
  .tl-content { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 1rem; }
  .tl-scores { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.6rem; }
  .score-chip { font-size: 0.75rem; padding: 0.25rem 0.7rem; border-radius: 6px; border: 1px solid; background: var(--surface3); font-weight: 500; }

  /* ALERTS */
  .alert { display: flex; align-items: flex-start; gap: 0.75rem; padding: 1rem 1.2rem; border-radius: 10px; margin-bottom: 1rem; font-size: 0.875rem; }
  .alert-warn   { background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.25); color: var(--warn); }
  .alert-danger { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.25); color: var(--danger); }
  .alert-info   { background: rgba(45,212,191,0.07); border: 1px solid rgba(45,212,191,0.2); color: var(--accent); }
  .patient-theme .alert-warn   { background: #FFFBEB; border: 1px solid #FDE68A; color: var(--warn); }
  .patient-theme .alert-danger { background: #FEF2F2; border: 1px solid #FECACA; color: var(--danger); }
  .patient-theme .alert-info   { background: #EFF6FF; border: 1px solid #BFDBFE; color: var(--accent); }

  /* MODAL */
  .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 200; display: flex;
    align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(6px); }
  .modal { background: var(--surface); border: 1px solid var(--border-bright); border-radius: 16px;
    padding: 2rem; max-width: 540px; width: 100%; max-height: 85vh; overflow-y: auto;
    box-shadow: 0 24px 80px rgba(0,0,0,0.5); }
  .modal-title { font-family: var(--font-display); font-size: 1.4rem; margin-bottom: 1.5rem; color: var(--text); }

  /* PATIENT PORTAL */
  .portal-card { max-width: 680px; margin: 0 auto; padding: 2rem 1rem; }
  .portal-header { text-align: center; padding: 2.5rem 1rem 1.5rem; }
  .portal-logo { font-family: var(--font-display); font-size: 2.2rem; color: var(--accent); }
  .progress-bar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 2rem; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 3px; transition: width 0.4s ease; }

  /* INTERVENTION */
  .intervention-btn { font-size: 0.75rem; padding: 0.25rem 0.7rem; border-radius: 4px;
    background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.25); color: var(--success); cursor: pointer;
    transition: all 0.15s; font-family: var(--font-body); }
  .intervention-btn:hover { background: rgba(52,211,153,0.2); }
  .intervention-entry { padding: 0.5rem 0; border-bottom: 1px solid var(--border); font-size: 0.82rem; }
  .intervention-entry:last-child { border-bottom: none; }

  /* FLOWCHART */
  .flow-node { padding: 0.7rem 1.1rem; border-radius: 8px; font-size: 0.82rem; font-weight: 500; white-space: nowrap; border: 1.5px solid; }
  .flow-arrow { width: 32px; height: 2px; background: var(--border-bright); position: relative; flex-shrink: 0; }
  .flow-arrow::after { content: '▶'; position: absolute; right: -6px; top: -8px; color: var(--muted); font-size: 10px; }
  .flow-down { width: 2px; height: 24px; background: var(--border-bright); margin: 0 auto; opacity: 0.6; }

  /* SECTION DIVIDER */
  .section-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--muted);
    font-weight: 600; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; }
  .section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  /* ── HOMEPAGE ── */
  @keyframes gradientShift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes orb1 {
    0%, 100% { transform: translate(0px, 0px) scale(1); }
    33%       { transform: translate(60px, -40px) scale(1.08); }
    66%       { transform: translate(-30px, 50px) scale(0.95); }
  }
  @keyframes orb2 {
    0%, 100% { transform: translate(0px, 0px) scale(1); }
    33%       { transform: translate(-50px, 60px) scale(1.06); }
    66%       { transform: translate(40px, -30px) scale(0.97); }
  }
  @keyframes orb3 {
    0%, 100% { transform: translate(0px, 0px) scale(1); }
    50%       { transform: translate(30px, 40px) scale(1.05); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .home-bg {
    position: fixed; inset: 0; z-index: 0;
    background: #05080F;
    overflow: hidden;
  }
  .home-orb {
    position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.55; pointer-events: none;
  }
  .home-orb-1 {
    width: 600px; height: 600px;
    background: radial-gradient(circle, #1a3a6e 0%, #0d1f40 60%, transparent 100%);
    top: -150px; left: -100px;
    animation: orb1 18s ease-in-out infinite;
  }
  .home-orb-2 {
    width: 700px; height: 700px;
    background: radial-gradient(circle, #0f4a3c 0%, #07271e 60%, transparent 100%);
    bottom: -200px; right: -150px;
    animation: orb2 22s ease-in-out infinite;
  }
  .home-orb-3 {
    width: 450px; height: 450px;
    background: radial-gradient(circle, #1e1560 0%, #0f0b30 60%, transparent 100%);
    top: 40%; left: 55%;
    animation: orb3 15s ease-in-out infinite;
  }
  .home-noise {
    position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    opacity: 0.35; pointer-events: none;
  }
  .home-wrap {
    position: relative; z-index: 1; min-height: 100vh;
    display: flex; flex-direction: column; width: 100%; max-width: 1280px; margin: 0 auto;
  }
  .home-nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1.5rem 3rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    animation: fadeIn 0.8s ease both;
  }
  .home-logo {
    font-family: var(--font-display); font-size: 1.5rem; letter-spacing: -0.5px;
    background: linear-gradient(135deg, #2DD4BF 0%, #34D399 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .home-nav-link {
    font-size: 0.85rem; color: rgba(255,255,255,0.45); background: none; border: none;
    cursor: pointer; font-family: var(--font-body); transition: color 0.2s; padding: 0;
  }
  .home-nav-link:hover { color: rgba(255,255,255,0.85); }

  .home-hero {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 4rem 2rem 6rem; text-align: center;
  }
  .home-eyebrow {
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-size: 0.72rem; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;
    color: #2DD4BF; border: 1px solid rgba(45,212,191,0.25);
    background: rgba(45,212,191,0.07); border-radius: 20px; padding: 0.35rem 1rem;
    margin-bottom: 2rem;
    animation: fadeUp 0.7s ease 0.1s both;
  }
  .home-eyebrow-dot {
    width: 6px; height: 6px; border-radius: 50%; background: #2DD4BF;
    box-shadow: 0 0 8px #2DD4BF; animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }
  .home-h1 {
    font-family: var(--font-display); font-size: clamp(3rem, 7vw, 5.5rem);
    line-height: 1.05; letter-spacing: -1.5px; margin-bottom: 1.5rem; color: #E6EDF3;
    animation: fadeUp 0.7s ease 0.2s both;
  }
  .home-h1 em {
    font-style: italic;
    background: linear-gradient(135deg, #2DD4BF 0%, #34D399 50%, #F59E0B 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .home-sub {
    font-size: 1.1rem; color: rgba(230,237,243,0.55); line-height: 1.7;
    max-width: 520px; margin: 0 auto 3rem;
    animation: fadeUp 0.7s ease 0.3s both;
  }
  .home-actions {
    display: flex; gap: 1rem; align-items: center; justify-content: center; flex-wrap: wrap;
    animation: fadeUp 0.7s ease 0.4s both;
  }
  .home-btn-primary {
    display: inline-flex; align-items: center; gap: 0.5rem;
    background: #2DD4BF; color: #05080F; font-weight: 700;
    padding: 0.85rem 2rem; border-radius: 100px; font-size: 0.95rem;
    border: none; cursor: pointer; font-family: var(--font-body);
    transition: all 0.25s; letter-spacing: 0.2px;
    box-shadow: 0 0 30px rgba(45,212,191,0.25);
  }
  .home-btn-primary:hover {
    background: #5EEAD4; transform: translateY(-2px);
    box-shadow: 0 0 40px rgba(45,212,191,0.4);
  }
  .home-btn-secondary {
    display: inline-flex; align-items: center; gap: 0.5rem;
    background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.75);
    border: 1px solid rgba(255,255,255,0.12); font-weight: 500;
    padding: 0.85rem 2rem; border-radius: 100px; font-size: 0.95rem;
    cursor: pointer; font-family: var(--font-body); transition: all 0.25s;
    backdrop-filter: blur(8px);
  }
  .home-btn-secondary:hover {
    background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.22);
    color: #fff; transform: translateY(-2px);
  }
  .home-features {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
    max-width: 800px; width: 100%; margin: 5rem auto 0;
    border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: hidden;
    animation: fadeUp 0.7s ease 0.55s both;
    background: rgba(255,255,255,0.07);
  }
  .home-feature {
    background: rgba(5,8,15,0.7); backdrop-filter: blur(12px);
    padding: 1.75rem 1.5rem; text-align: left;
  }
  .home-feature-icon {
    font-size: 1.4rem; margin-bottom: 0.75rem; display: block;
  }
  .home-feature-title {
    font-size: 0.9rem; font-weight: 600; color: rgba(255,255,255,0.85); margin-bottom: 0.4rem;
  }
  .home-feature-desc {
    font-size: 0.8rem; color: rgba(255,255,255,0.35); line-height: 1.6;
  }
  .home-footer {
    text-align: center; padding: 1.5rem; font-size: 0.75rem;
    color: rgba(255,255,255,0.2); border-top: 1px solid rgba(255,255,255,0.05);
    animation: fadeIn 1s ease 0.8s both;
  }

  /* ABOUT PAGE (shares home background) */
  .about-shell {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem 6rem;
    text-align: center;
  }
  .about-title {
    font-family: var(--font-display);
    font-size: clamp(2.2rem, 4vw, 3.2rem);
    letter-spacing: -1px;
    margin-bottom: 0.75rem;
    color: rgba(230,237,243,0.95);
  }
  .about-sub {
    font-size: 1.05rem;
    color: rgba(230,237,243,0.55);
    line-height: 1.8;
    max-width: 760px;
    margin: 0 auto 2.25rem;
  }
  .about-grid {
    width: 100%;
    max-width: 900px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin: 0 auto;
  }
  .about-card {
    background: rgba(5,8,15,0.7);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    padding: 1.25rem 1.25rem;
    text-align: left;
    backdrop-filter: blur(12px);
  }
  .about-card h3 {
    font-size: 0.95rem;
    color: rgba(255,255,255,0.85);
    margin-bottom: 0.4rem;
    font-weight: 700;
  }
  .about-card p {
    font-size: 0.82rem;
    color: rgba(255,255,255,0.35);
    line-height: 1.7;
  }
  .about-actions { display: flex; justify-content: center; gap: 1rem; margin-top: 2.25rem; flex-wrap: wrap; }
  .about-back {
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.75);
    border: 1px solid rgba(255,255,255,0.12);
    font-weight: 600;
    padding: 0.85rem 2rem;
    border-radius: 100px;
    font-size: 0.95rem;
    cursor: pointer;
    font-family: var(--font-body);
    transition: all 0.25s;
    backdrop-filter: blur(8px);
  }
  .about-back:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.22);
    color: #fff;
    transform: translateY(-2px);
  }

  /* LOGIN MODAL */
  .login-modal-bg {
    position: fixed; inset: 0; z-index: 300;
    display: flex; align-items: center; justify-content: center; padding: 1rem;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(12px);
    animation: fadeIn 0.2s ease;
  }
  .login-modal {
    background: #0F1620; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px;
    padding: 2.5rem; max-width: 420px; width: 100%;
    box-shadow: 0 32px 80px rgba(0,0,0,0.6);
    animation: fadeUp 0.3s ease;
  }
  .login-title {
    font-family: var(--font-display); font-size: 1.6rem; color: #E6EDF3;
    margin-bottom: 0.4rem;
  }
  .login-sub { font-size: 0.85rem; color: rgba(255,255,255,0.35); margin-bottom: 2rem; }
  .login-input {
    width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    color: #E6EDF3; padding: 0.75rem 1rem; border-radius: 10px;
    font-size: 0.9rem; font-family: var(--font-body); outline: none; margin-bottom: 0.75rem;
    transition: border-color 0.2s;
  }
  .login-input:focus { border-color: #2DD4BF; }
  .login-input::placeholder { color: rgba(255,255,255,0.25); }

  @media (max-width: 768px) {
    .home-nav { padding: 1.25rem 1.5rem; }
    .home-features { grid-template-columns: 1fr; }
    .home-actions { flex-direction: column; width: 100%; max-width: 320px; }
    .home-btn-primary, .home-btn-secondary { width: 100%; justify-content: center; }
    .about-grid { grid-template-columns: 1fr; }
    .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
    .main { padding: 1rem; }
    .nav { padding: 0.875rem 1rem; }
  }
`;

// ─── UTILITIES ───────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const scoreAssessment = (answers) => answers.reduce((s, a) => s + (Number(a) || 0), 0);
const calcPHQ9Positive = (score) => score >= 10;
const calcGAD7Moderate = (score) => score >= 10;

// ─── SEED DATA ───────────────────────────────────────────────────────────────
const makeFakeAnswers = (def, targetScore) => {
  const n = def.questions.length;
  const maxPer = Array.isArray(def.options[0]) ? 4 : def.options.length - 1;
  const avg = Math.min(maxPer, Math.max(0, Math.round(targetScore / n)));
  return Array(n).fill(0).map((_, i) => {
    const jitter = Math.floor(Math.random() * 2) - 0;
    return Math.min(maxPer, Math.max(0, avg + (i % 2 === 0 ? jitter : -jitter)));
  });
};

const makeTrend = (start, end, steps, noise = 1.5) => {
  return Array(steps).fill(0).map((_, i) => {
    const base = start + (end - start) * (i / Math.max(steps - 1, 1));
    return Math.max(0, Math.round(base + (Math.random() - 0.5) * noise * 2));
  });
};

const DAY = 86400000;
const now = Date.now();

const SAMPLE_PATIENTS = [
  {
    id: "sp_001", name: "Margaret Chen", email: "m.chen@email.com",
    createdAt: now - 5 * 365 * DAY,
    note: "5-year longitudinal case: MDD with GAD. Initial severe presentation, gradual improvement with medication + therapy, partial relapse at 3 years, stabilization.",
    history: (() => {
      const entries = [];
      // 5 years of data, roughly every 6-8 weeks = ~35 data points
      const phq9Trend  = makeTrend(22, 8,  35, 2);
      const gad7Trend  = makeTrend(18, 6,  35, 2);
      const qidsTrend  = makeTrend(19, 7,  35, 2);
      // relapse bump around index 20-24
      [20,21,22,23,24].forEach(i => { phq9Trend[i] += 8; gad7Trend[i] += 6; qidsTrend[i] += 7; });
      for (let i = 0; i < 35; i++) {
        const t = now - (35 - i) * 52 * DAY;
        const phq9Score = Math.min(27, Math.max(0, phq9Trend[i]));
        const gad7Score = Math.min(21, Math.max(0, gad7Trend[i]));
        const qidsScore = Math.min(27, Math.max(0, qidsTrend[i]));
        const scores = i === 0 ? { gad7: gad7Score, phq9: phq9Score, assist: 3, auditc: 4 }
                     : i < 3   ? { gad7: gad7Score, phq9: phq9Score, assist: 2, auditc: 3 }
                     : { gad7: gad7Score, phq9: phq9Score, qidssr: qidsScore };
        const interventions = [];
        if (i === 0) interventions.push({ id: uid(), type: "Medication change", note: "Started sertraline 50mg. Discussed CBT referral.", createdAt: t });
        if (i === 2) interventions.push({ id: uid(), type: "Therapy referral", note: "Enrolled in weekly CBT. Sertraline titrated to 100mg.", createdAt: t });
        if (i === 8) interventions.push({ id: uid(), type: "Medication change", note: "PHQ-9 improving. Maintained sertraline 100mg.", createdAt: t });
        if (i === 20) interventions.push({ id: uid(), type: "Safety planning", note: "Score elevation noted — stressful life event (job loss). Increased session frequency.", createdAt: t });
        if (i === 22) interventions.push({ id: uid(), type: "Medication change", note: "Added buspirone 10mg BID for anxiety augmentation.", createdAt: t });
        if (i === 26) interventions.push({ id: uid(), type: "Psychoeducation", note: "Relapse prevention strategies reviewed. Sleep hygiene reinforced.", createdAt: t });
        entries.push({ id: uid(), patientId: "sp_001", completedAt: t, scores, answers: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, makeFakeAnswers(ASSESSMENTS[k], v)])), interventions });
      }
      return entries;
    })()
  },
  {
    id: "sp_002", name: "James Okafor", email: "j.okafor@email.com",
    createdAt: now - 6 * 30 * DAY,
    note: "6-month case: Moderate GAD, initiating SSRI. Steady improvement trajectory.",
    history: (() => {
      const entries = [];
      const gad7Trend = makeTrend(15, 5, 7, 1.5);
      const phq9Trend = makeTrend(11, 5, 7, 1.5);
      for (let i = 0; i < 7; i++) {
        const t = now - (7 - i) * 26 * DAY;
        const gad7Score = Math.min(21, Math.max(0, gad7Trend[i]));
        const phq9Score = Math.min(27, Math.max(0, phq9Trend[i]));
        const qidsScore = Math.min(27, Math.max(0, Math.round(phq9Score * 0.7 + (Math.random()-0.5)*2)));
        const scores = i === 0 ? { gad7: gad7Score, phq9: phq9Score, assist: 1, auditc: 5 }
                     : { gad7: gad7Score, phq9: phq9Score, qidssr: qidsScore };
        const interventions = [];
        if (i === 0) interventions.push({ id: uid(), type: "Medication change", note: "Started escitalopram 10mg for GAD/MDD. Psychoeducation provided.", createdAt: t });
        if (i === 2) interventions.push({ id: uid(), type: "Medication change", note: "Escitalopram increased to 20mg — partial response at 10mg.", createdAt: t });
        if (i === 4) interventions.push({ id: uid(), type: "Therapy referral", note: "Referred for mindfulness-based cognitive therapy.", createdAt: t });
        entries.push({ id: uid(), patientId: "sp_002", completedAt: t, scores, answers: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, makeFakeAnswers(ASSESSMENTS[k], v)])), interventions });
      }
      return entries;
    })()
  },
  {
    id: "sp_003", name: "Sofia Reyes", email: "s.reyes@email.com",
    createdAt: now - 4 * 365 * DAY,
    note: "4-year case: Bipolar II with SUD history. Complex trajectory with substance use fluctuations and mood cycling.",
    history: (() => {
      const entries = [];
      const n = 28;
      // Mood cycling pattern
      const phq9Base  = Array(n).fill(0).map((_, i) => 10 + 8 * Math.sin(i * 0.7) + (Math.random()-0.5)*3);
      const gad7Base  = Array(n).fill(0).map((_, i) =>  8 + 5 * Math.sin(i * 0.5 + 1) + (Math.random()-0.5)*2);
      const assistBase = Array(n).fill(0).map((_, i) => i < 12 ? 14 + (Math.random()-0.5)*4 : 5 + (Math.random()-0.5)*3);
      for (let i = 0; i < n; i++) {
        const t = now - (n - i) * 52 * DAY;
        const phq9Score  = Math.min(27, Math.max(0, Math.round(phq9Base[i])));
        const gad7Score  = Math.min(21, Math.max(0, Math.round(gad7Base[i])));
        const assistScore = Math.min(40, Math.max(0, Math.round(assistBase[i])));
        const qidsScore  = Math.min(27, Math.max(0, Math.round(phq9Score * 0.75)));
        const scores = i === 0 ? { gad7: gad7Score, phq9: phq9Score, assist: assistScore, auditc: 6 }
                     : { gad7: gad7Score, phq9: phq9Score, qidssr: qidsScore, assist: assistScore };
        const interventions = [];
        if (i === 0)  interventions.push({ id: uid(), type: "Medication change", note: "Initiated lamotrigine 25mg, titrating. SUD counseling referral.", createdAt: t });
        if (i === 3)  interventions.push({ id: uid(), type: "Therapy referral", note: "Enrolled in DBT group. Lamotrigine 100mg.", createdAt: t });
        if (i === 10) interventions.push({ id: uid(), type: "Safety planning", note: "ASSIST scores elevated. Discussed harm reduction. Referred to addiction psychiatry.", createdAt: t });
        if (i === 13) interventions.push({ id: uid(), type: "Medication change", note: "ASSIST improving. Added naltrexone 50mg for alcohol use.", createdAt: t });
        if (i === 18) interventions.push({ id: uid(), type: "Psychoeducation", note: "Mood cycling discussed. Sleep tracking initiated.", createdAt: t });
        if (i === 24) interventions.push({ id: uid(), type: "Medication change", note: "Lamotrigine 200mg — stable for 6 months.", createdAt: t });
        entries.push({ id: uid(), patientId: "sp_003", completedAt: t, scores, answers: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, makeFakeAnswers(ASSESSMENTS[k], v)])), interventions });
      }
      return entries;
    })()
  },
  {
    id: "sp_004", name: "David Park", email: "d.park@email.com",
    createdAt: now - 2 * 365 * DAY,
    note: "2-year case: ADHD + anxiety. Stable on stimulant, GAD well-controlled.",
    history: (() => {
      const entries = [];
      const n = 14;
      const gad7Trend = makeTrend(14, 4, n, 1.5);
      const phq9Trend = makeTrend(9,  3, n, 1.2);
      for (let i = 0; i < n; i++) {
        const t = now - (n - i) * 52 * DAY;
        const gad7Score = Math.min(21, Math.max(0, gad7Trend[i]));
        const phq9Score = Math.min(27, Math.max(0, phq9Trend[i]));
        const scores = i === 0 ? { gad7: gad7Score, phq9: phq9Score, assist: 0, auditc: 2 }
                     : { gad7: gad7Score, phq9: phq9Score };
        const interventions = [];
        if (i === 0) interventions.push({ id: uid(), type: "Medication change", note: "Started methylphenidate ER 18mg. Concurrent GAD management.", createdAt: t });
        if (i === 2) interventions.push({ id: uid(), type: "Medication change", note: "Increased to 36mg — partial response. Added low-dose buspirone.", createdAt: t });
        if (i === 6) interventions.push({ id: uid(), type: "Psychoeducation", note: "Anxiety well-controlled. Reviewed sleep and exercise habits.", createdAt: t });
        if (i === 10) interventions.push({ id: uid(), type: "Other", note: "Annual review — stable. Maintained current regimen.", createdAt: t });
        entries.push({ id: uid(), patientId: "sp_004", completedAt: t, scores, answers: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, makeFakeAnswers(ASSESSMENTS[k], v)])), interventions });
      }
      return entries;
    })()
  },
  {
    id: "sp_005", name: "Amara Osei", email: "a.osei@email.com",
    createdAt: now - 18 * 30 * DAY,
    note: "18-month case: PTSD + MDD. Prolonged exposure therapy + SSRI. Showing steady improvement.",
    history: (() => {
      const entries = [];
      const n = 10;
      const phq9Trend = makeTrend(20, 9,  n, 2);
      const gad7Trend = makeTrend(17, 7,  n, 2);
      const qidsTrend = makeTrend(17, 8,  n, 2);
      for (let i = 0; i < n; i++) {
        const t = now - (n - i) * 55 * DAY;
        const phq9Score = Math.min(27, Math.max(0, phq9Trend[i]));
        const gad7Score = Math.min(21, Math.max(0, gad7Trend[i]));
        const qidsScore = Math.min(27, Math.max(0, qidsTrend[i]));
        const scores = i === 0 ? { gad7: gad7Score, phq9: phq9Score, assist: 2, auditc: 3 }
                     : { gad7: gad7Score, phq9: phq9Score, qidssr: qidsScore };
        const interventions = [];
        if (i === 0) interventions.push({ id: uid(), type: "Therapy referral", note: "Referred for Prolonged Exposure therapy. Started sertraline 50mg.", createdAt: t });
        if (i === 2) interventions.push({ id: uid(), type: "Medication change", note: "Sertraline titrated to 150mg. PE therapy week 4.", createdAt: t });
        if (i === 5) interventions.push({ id: uid(), type: "Psychoeducation", note: "Significant improvement noted. Reinforced trauma coping strategies.", createdAt: t });
        if (i === 8) interventions.push({ id: uid(), type: "Other", note: "Considering step-down from weekly PE to monthly maintenance.", createdAt: t });
        entries.push({ id: uid(), patientId: "sp_005", completedAt: t, scores, answers: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, makeFakeAnswers(ASSESSMENTS[k], v)])), interventions });
      }
      return entries;
    })()
  },
];

let didSeedSupabaseDemoResults = false;

const seedDemoData = async (clinicianId) => {
  // Seed sample patients into Supabase `patients` table if missing (for this clinician).
  if (!clinicianId) return;
  try {
    const { data: existingPatients, error: patientsErr } = await supabase
      .from("patients")
      .select("id")
      .eq("clinician_id", clinicianId);
    if (patientsErr) throw patientsErr;
    const existingIds = new Set((existingPatients || []).map(p => p.id));
    const toInsert = SAMPLE_PATIENTS
      .filter(p => !existingIds.has(p.id))
      .map(({ id, name, email, createdAt }) => ({
        id,
        name,
        email,
        created_at: new Date(createdAt).toISOString(),
        clinician_id: clinicianId,
      }));
    if (toInsert.length > 0) {
      await supabase.from("patients").insert(toInsert);
    }
  } catch {
    // If seeding patients fails, continue; app will still function for existing rows.
  }

  // Seed demo results into Supabase (id, patient_id, data) if missing.
  if (didSeedSupabaseDemoResults) return;
  try {
    const sampleIds = SAMPLE_PATIENTS.map(p => p.id);
    const { data: existingRows, error: existingErr } = await supabase
      .from("results")
      .select("id")
      .in("patient_id", sampleIds);
    if (existingErr) throw existingErr;

    const existingResultIds = new Set((existingRows || []).map(r => r.id));
    const toUpsert = [];

    for (const sp of SAMPLE_PATIENTS) {
      for (const entry of sp.history || []) {
        if (entry?.id && !existingResultIds.has(entry.id)) {
          toUpsert.push({ id: entry.id, patient_id: sp.id, data: entry });
        }
      }
    }

    if (toUpsert.length > 0) {
      const { error } = await supabase
        .from("results")
        .upsert(toUpsert, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    }

    didSeedSupabaseDemoResults = true;
  } catch {
    // If seeding fails (e.g. RLS), keep the app usable; we'll retry on next refresh.
  }
};

// ─── MANUAL SUPABASE SEED HELPER ───────────────────────────────────────────────
async function forceSeedToSupabase() {
  try {
    // eslint-disable-next-line no-console
    console.log("[forceSeedToSupabase] Starting demo seed into Supabase `results`…");
    const sampleIds = SAMPLE_PATIENTS.map(p => p.id);

    const { data: existingRows, error: existingErr } = await supabase
      .from("results")
      .select("id, patient_id")
      .in("patient_id", sampleIds);

    if (existingErr) {
      // eslint-disable-next-line no-console
      console.error("[forceSeedToSupabase] Failed to fetch existing results:", existingErr);
      throw existingErr;
    }

    const existingResultIds = new Set((existingRows || []).map(r => r.id));
    const toUpsert = [];

    for (const sp of SAMPLE_PATIENTS) {
      for (const entry of sp.history || []) {
        if (!entry?.id) continue;
        if (existingResultIds.has(entry.id)) {
          // eslint-disable-next-line no-console
          console.log(
            `[forceSeedToSupabase] Skipping existing result id=${entry.id} patient_id=${sp.id}`
          );
          continue;
        }
        toUpsert.push({ id: entry.id, patient_id: sp.id, data: entry });
      }
    }

    if (toUpsert.length === 0) {
      // eslint-disable-next-line no-console
      console.log("[forceSeedToSupabase] No new demo results to insert. Done.");
      return;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[forceSeedToSupabase] Inserting ${toUpsert.length} demo results into Supabase…`
    );

    const { error: upsertErr } = await supabase
      .from("results")
      .upsert(toUpsert, { onConflict: "id", ignoreDuplicates: true });

    if (upsertErr) {
      // eslint-disable-next-line no-console
      console.error("[forceSeedToSupabase] Upsert failed:", upsertErr);
      throw upsertErr;
    }

    // eslint-disable-next-line no-console
    console.log(
      "[forceSeedToSupabase] Demo results successfully seeded into Supabase `results`."
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[forceSeedToSupabase] Error while seeding:", e);
  }
}

if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.log("[forceSeedToSupabase] Exposed on window as window.forceSeedToSupabase()");
  // eslint-disable-next-line no-undef
  window.forceSeedToSupabase = forceSeedToSupabase;
}

// ─── ASSESSMENT FORM ─────────────────────────────────────────────────────────
function AssessmentForm({ def, onComplete, onSkip }) {
  const [answers, setAnswers] = useState(Array(def.questions.length).fill(null));

  const setAnswer = (i, v) => setAnswers(prev => { const a = [...prev]; a[i] = v; return a; });
  const isSpecifyQuestion = (i) => def.questions[i]?.toLowerCase().includes("please specify");
  const allAnswered = answers.every((a, i) =>
    isSpecifyQuestion(i) ? (typeof a === "string" && a.trim() !== "") : a !== null
  );
  const total = scoreAssessment(answers.map(a => (typeof a === "string" ? 0 : (a ?? 0))));

  return (
    <div className="card" style={{ marginBottom: "1.5rem" }}>
      {/* Timeframe banner */}
      <div style={{ marginBottom: "1.5rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "rgba(29,78,216,0.08)",
          border: "1px solid rgba(29,78,216,0.18)", borderRadius: "20px", padding: "0.3rem 0.85rem",
          fontSize: "0.78rem", fontWeight: 600, color: "var(--accent)", marginBottom: "0.6rem", letterSpacing: "0.2px" }}>
          <span>🕐</span> {def.timeframe}
        </div>
        <p style={{ color: "var(--text-soft)", fontSize: "0.95rem", lineHeight: 1.5, fontWeight: 500 }}>
          {def.instruction}
        </p>
      </div>

      {def.questions.map((q, i) => {
        const opts = Array.isArray(def.options[0]) ? def.options[i] : def.options;
        const useTextInput = isSpecifyQuestion(i);
        return (
          <div className="q-item" key={i}>
            <div className="q-text"><span style={{ color: "var(--muted)", marginRight: "0.5rem" }}>{i + 1}.</span>{q}</div>
            <div className="q-options">
              {useTextInput ? (
                <input
                  type="text"
                  className="input"
                  placeholder="Specify here…"
                  value={answers[i] ?? ""}
                  onChange={(e) => setAnswer(i, e.target.value)}
                  style={{ marginTop: "0.25rem" }}
                />
              ) : (
                opts.map((opt, j) => (
                  <button key={j} className={`q-option${answers[i] === j ? " selected" : ""}`} onClick={() => setAnswer(i, j)}>
                    {opt}
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" disabled={!allAnswered} onClick={() => onComplete(answers, total)}>
          Submit & Continue →
        </button>
      </div>
    </div>
  );
}

// ─── PATIENT PORTAL ───────────────────────────────────────────────────────────
function PatientPortal({ sessionId, onDone }) {
  const [session, setSession] = useState(null);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [results, setResults] = useState({});
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setLoadError("");
        const { data, error } = await supabase
          .from("sessions")
          .select("data")
          .eq("id", sessionId)
          .maybeSingle();
        if (error) throw error;
        setSession(data?.data ?? null);
      } catch (e) {
        setSession(null);
        setLoadError(e?.message || "Unable to load session.");
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "var(--muted)" }}>Loading your assessment…</div>;
  if (!session) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: "var(--danger)" }}>
        Session not found or expired.
        {loadError && (
          <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--muted)" }}>
            {loadError}
          </div>
        )}
      </div>
    );
  }

  const queue = session.assessments;
  const current = queue[step];
  const def = ASSESSMENTS[current];
  const progress = (step / queue.length) * 100;

  // ── Intro screen ──
  if (!started) {
    return (
      <div style={{ maxWidth: "620px", margin: "0 auto", padding: "3rem 1rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div className="portal-logo" style={{ marginBottom: "0.75rem" }}>
            Psy<span style={{ color: "var(--accent2)", fontStyle: "italic" }}>Track</span>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Assessment for <strong style={{ color: "var(--text)" }}>{session.patientName}</strong></p>
        </div>

        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.9rem", color: "var(--text)", marginBottom: "0.75rem", textAlign: "center" }}>
          Before we begin
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.7, textAlign: "center", maxWidth: "480px", margin: "0 auto 2rem" }}>
          Your clinician has asked you to complete a brief set of assessments. Your answers help them provide more personalized care during your visit.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", background: "#FFFFFF",
            border: "1px solid var(--border)", borderRadius: "12px", padding: "1.1rem 1.25rem" }}>
            <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>🔒</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)", marginBottom: "0.25rem" }}>Your responses are confidential</div>
              <div style={{ fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.6 }}>Only your treating clinician has access to your answers. Your information is never shared with third parties, employers, or insurers without your explicit consent.</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", background: "#FFFFFF",
            border: "1px solid var(--border)", borderRadius: "12px", padding: "1.1rem 1.25rem" }}>
            <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>📋</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)", marginBottom: "0.25rem" }}>What to expect</div>
              <div style={{ fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.6 }}>You will complete <strong style={{ color: "var(--text)" }}>{queue.length} short assessment{queue.length > 1 ? "s" : ""}</strong> covering mood, anxiety, and substance use. Most people finish in under 10 minutes. Answer honestly — there are no right or wrong answers.</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", background: "#FFFFFF",
            border: "1px solid var(--border)", borderRadius: "12px", padding: "1.1rem 1.25rem" }}>
            <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>💬</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)", marginBottom: "0.25rem" }}>How your results are used</div>
              <div style={{ fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.6 }}>Your clinician will review your responses before or during your appointment to help focus on what matters most to you.</div>
            </div>
          </div>
        </div>

        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px",
          padding: "0.9rem 1.1rem", marginBottom: "2rem", fontSize: "0.82rem", color: "#991B1B", lineHeight: 1.6 }}>
          <strong>If you are in crisis or experiencing a psychiatric emergency,</strong> please call or text <strong>988</strong> (Suicide & Crisis Lifeline) or go to your nearest emergency room.
        </div>

        <button className="btn btn-primary btn-full" style={{ padding: "0.85rem", fontSize: "0.95rem", borderRadius: "10px" }}
          onClick={() => { setStarted(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          I understand — Begin Assessment →
        </button>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.75rem", marginTop: "1rem" }}>
          By continuing you confirm that you are completing this assessment for yourself.
        </p>
      </div>
    );
  }

  const handleComplete = async (answers, total) => {
    const newResults = { ...results, [current]: { answers, total, completedAt: Date.now() } };
    setResults(newResults);

    if (step + 1 >= queue.length) {
      // Save result
      const resultObj = {
        id: uid(), sessionId, patientId: session.patientId, completedAt: Date.now(),
        scores: Object.fromEntries(Object.entries(newResults).map(([k, v]) => [k, v.total])),
        answers: Object.fromEntries(Object.entries(newResults).map(([k, v]) => [k, v.answers])),
        interventions: [],
      };
      // Persist result in Supabase
      await supabase.from("results").upsert({
        id: resultObj.id,
        patient_id: session.patientId,
        data: resultObj,
      });

      // Mark session done
      const updSession = { ...session, completed: true, completedAt: Date.now() };
      await supabase.from("sessions").update({ data: updSession }).eq("id", sessionId);

      // Check for follow-up triggers
      const phq9Score = newResults.phq9?.total ?? 0;
      const gad7Score = newResults.gad7?.total ?? 0;
      if (calcPHQ9Positive(phq9Score)) {
        // schedule QIDS-SR every 2 weeks x 12
        const scheduled = await load(`scheduled:${session.patientId}`, true) || [];
        for (let w = 1; w <= 12; w++) {
          scheduled.push({ id: uid(), patientId: session.patientId, assessments: ["qidssr"],
            dueDate: Date.now() + w * 14 * 86400000, triggered: "phq9_positive", sent: false });
        }
        await save(`scheduled:${session.patientId}`, scheduled, true);
      }
      if (calcGAD7Moderate(gad7Score)) {
        const scheduled = await load(`scheduled:${session.patientId}`, true) || [];
        for (let m = 1; m <= 6; m++) {
          scheduled.push({ id: uid(), patientId: session.patientId, assessments: ["gad7"],
            dueDate: Date.now() + m * 30 * 86400000, triggered: "gad7_moderate", sent: false });
        }
        await save(`scheduled:${session.patientId}`, scheduled, true);
      }

      setDone(true);
    } else {
      setStep(s => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (done) {
    return (
      <div className="portal-card">
        <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "1.5rem" }}>✓</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", color: "var(--accent2)", marginBottom: "1rem" }}>
            Thank You
          </h2>
          <p style={{ color: "var(--muted)", lineHeight: "1.8", maxWidth: "420px", margin: "0 auto" }}>
            Your responses have been securely submitted to your provider. They will review your answers and follow up with you as needed.
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "1.5rem" }}>
            If you are in crisis, please call or text <strong style={{ color: "var(--text)" }}>988</strong> (Suicide & Crisis Lifeline).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-card">
      <div className="portal-header">
        <div className="portal-logo">Psy<span style={{ color: "var(--accent2)", fontStyle: "italic" }}>Track</span></div>
        <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>Assessment for {session.patientName}</p>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: "1rem" }}>
        Assessment {step + 1} of {queue.length}
      </div>
      {def && <AssessmentForm key={`portal-${def.id}-${step}`} def={def} onComplete={handleComplete} />}
    </div>
  );
}

// ─── INTERVENTION MODAL ───────────────────────────────────────────────────────
function InterventionModal({ result, onClose, onSave }) {
  const [note, setNote] = useState("");
  const [itype, setItype] = useState("Medication change");
  const types = ["Medication change", "Therapy referral", "Psychoeducation", "Safety planning", "Lab ordered", "Other"];

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3 className="modal-title">Log Intervention</h3>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
          Document the clinical action taken at this data point ({fmtDate(result.completedAt)}).
        </p>
        <div className="form-group">
          <label className="label">Intervention Type</label>
          <select className="input" value={itype} onChange={e => setItype(e.target.value)}
            style={{ background: "var(--surface2)", color: "var(--text)", cursor: "pointer" }}>
            {types.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="label">Clinical Notes</label>
          <textarea className="input textarea" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Describe the intervention, rationale, and expected outcome…" />
        </div>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" disabled={!note.trim()} onClick={() => { onSave(itype, note); onClose(); }}>
            Save Intervention
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PATIENT DETAIL ───────────────────────────────────────────────────────────
function PatientDetail({ patient, onBack }) {
  const [results, setResults] = useState([]);
  const [activeFilters, setActiveFilters] = useState(["gad7", "phq9", "qidssr", "assist", "auditc"]);
  const [interventionTarget, setInterventionTarget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("results")
        .select("data")
        .eq("patient_id", patient.id);
      const rows = (data || []).map(r => r.data || {});
      if (!error) {
        setResults(rows.sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0)));
      } else {
        setResults([]);
      }
      setLoading(false);
    })();
  }, [patient.id]);

  const toggleFilter = (id) => {
    setActiveFilters(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const chartData = results.map(r => ({
    date: fmtDate(r.completedAt),
    ...Object.fromEntries(Object.entries(r.scores || {}).map(([k, v]) => [ASSESSMENTS[k]?.label || k, v]))
  }));

  const addIntervention = async (resultId, type, note) => {
    const entry = { id: uid(), type, note, createdAt: Date.now() };
    const updated = results.map(r =>
      r.id === resultId ? { ...r, interventions: [...(r.interventions || []), entry] } : r
    );
    setResults(updated);
    const target = updated.find(r => r.id === resultId);
    if (target) {
      await supabase.from("results").update({ data: target }).eq("id", resultId);
    }
  };

  // Alerts
  const latestResult = results[results.length - 1];
  const alerts = [];
  if (latestResult) {
    if ((latestResult.scores?.gad7 || 0) >= 10) alerts.push({ type: "warn", msg: "GAD-7 ≥10 (Moderate/Severe anxiety) — Follow-up schedule active" });
    if ((latestResult.scores?.phq9 || 0) >= 10) alerts.push({ type: "danger", msg: "PHQ-9 ≥10 (Positive screen) — QIDS-SR follow-up schedule active" });
    if ((latestResult.scores?.phq9 || 0) >= 20) alerts.push({ type: "danger", msg: "PHQ-9 ≥20: Severe depression — assess suicide risk" });
    if ((latestResult.scores?.phq9 ? latestResult.answers?.phq9?.[8] >= 1 : false))
      alerts.push({ type: "danger", msg: "PHQ-9 Q9 positive — patient endorsed thoughts of self-harm" });
  }

  const allAssessmentIds = [...new Set(results.flatMap(r => Object.keys(r.scores || {})))];

  if (loading) return <div style={{ padding: "2rem", color: "var(--muted)" }}>Loading…</div>;

  return (
    <div>
      <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: "1.5rem" }}>← All Patients</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem" }}>{patient.name}</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{patient.email} · Patient since {fmtDate(patient.createdAt)}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <span className="badge" style={{ background: "rgba(56,189,248,0.1)", color: "var(--accent)", border: "1px solid rgba(56,189,248,0.2)" }}>
            {results.length} assessments
          </span>
        </div>
      </div>

      {alerts.map((a, i) => (
        <div key={i} className={`alert alert-${a.type}`}>
          <span>{a.type === "danger" ? "🚨" : "⚠️"}</span> {a.msg}
        </div>
      ))}

      {/* Stats */}
      {latestResult && (
        <div className="grid-4" style={{ marginBottom: "1.5rem" }}>
          {Object.entries(latestResult.scores || {}).map(([k, v]) => {
            const def = ASSESSMENTS[k];
            if (!def) return null;
            const sev = def.severity(v);
            return (
              <div className="stat-box" key={k}>
                <div className="stat-val" style={{ color: sev.color }}>{v}</div>
                <div className="stat-label">{def.label}</div>
                <span className="badge" style={{ marginTop: "0.5rem", background: `${sev.color}22`, color: sev.color, border: `1px solid ${sev.color}44` }}>{sev.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Chart */}
      {results.length > 1 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="card-title">Score Trends Over Time</div>
          <div className="filter-pills">
            {allAssessmentIds.map(id => {
              const def = ASSESSMENTS[id];
              if (!def) return null;
              return (
                <button key={id} className={`filter-pill${activeFilters.includes(id) ? " active" : ""}`}
                  onClick={() => toggleFilter(id)} style={{ borderColor: activeFilters.includes(id) ? def.color : undefined, color: activeFilters.includes(id) ? def.color : undefined }}>
                  {def.label}
                </button>
              );
            })}
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border-bright)", borderRadius: "8px", color: "var(--text)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }} labelStyle={{ color: "var(--muted)" }} />
                <Legend wrapperStyle={{ color: "#64748B", fontSize: "12px" }} />
                {allAssessmentIds.filter(id => activeFilters.includes(id)).map(id => {
                  const def = ASSESSMENTS[id];
                  if (!def) return null;
                  return <Line key={id} type="monotone" dataKey={def.label} stroke={def.color} strokeWidth={2} dot={{ fill: def.color, r: 4 }} />;
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card">
        <div className="card-title">Assessment Timeline & Interventions</div>
        <div className="timeline">
          {results.slice().reverse().map((r) => {
            const dotColor = r.scores?.phq9 >= 10 ? "var(--danger)" : r.scores?.gad7 >= 10 ? "var(--warn)" : "var(--accent2)";
            return (
              <div className="tl-item" key={r.id}>
                <div className="tl-dot" style={{ background: dotColor }} />
                <div className="tl-date">{fmtDate(r.completedAt)}</div>
                <div className="tl-content">
                  <div className="tl-scores">
                    {Object.entries(r.scores || {}).map(([k, v]) => {
                      const def = ASSESSMENTS[k];
                      if (!def) return null;
                      const sev = def.severity(v);
                      return (
                        <span key={k} className="score-chip" style={{ color: sev.color, borderColor: `${sev.color}44` }}>
                          {def.label}: {v} ({sev.label})
                        </span>
                      );
                    })}
                  </div>
                  {/* Interventions */}
                  {(r.interventions || []).length > 0 && (
                    <div style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>
                      {r.interventions.map(int => (
                        <div key={int.id} className="intervention-entry">
                          <span style={{ color: "var(--accent2)", fontWeight: 600 }}>{int.type}:</span>{" "}
                          <span style={{ color: "var(--muted)" }}>{int.note}</span>{" "}
                          <span style={{ color: "#334155", fontSize: "0.72rem" }}>— {fmtDate(int.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="intervention-btn" onClick={() => setInterventionTarget(r)}>
                    + Log Intervention
                  </button>
                </div>
              </div>
            );
          })}
          {results.length === 0 && <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No assessments completed yet.</p>}
        </div>
      </div>

      {interventionTarget && (
        <InterventionModal result={interventionTarget}
          onClose={() => setInterventionTarget(null)}
          onSave={(type, note) => addIntervention(interventionTarget.id, type, note)} />
      )}
    </div>
  );
}

// ─── NEW PATIENT MODAL ────────────────────────────────────────────────────────
function NewPatientModal({ clinicianId, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState(null);
  const [err, setErr] = useState("");

  const create = async () => {
    setSaving(true);
    setErr("");
    const patient = { id: uid(), name, email, createdAt: Date.now() };
    const { error: patientErr } = await supabase.from("patients").insert({
      id: patient.id,
      name: patient.name,
      email: patient.email,
      created_at: new Date(patient.createdAt).toISOString(),
      clinician_id: clinicianId ?? null,
    });
    if (patientErr) {
      setSaving(false);
      setErr(patientErr.message || "Failed to create patient.");
      return;
    }

    // Create initial session
    const sessionId = uid();
    const session = { id: sessionId, patientId: patient.id, patientName: name,
      assessments: ["gad7", "phq9", "assist", "auditc"], createdAt: Date.now(), completed: false };
    const { error: sessionErr } = await supabase.from("sessions").upsert({ id: sessionId, data: session });
    if (sessionErr) {
      setSaving(false);
      setErr(sessionErr.message || "Failed to create session.");
      return;
    }

    const url = `${window.location.origin}${window.location.pathname}?patient=${sessionId}`;
    setLink(url);
    setSaving(false);
    onCreated(patient);
  };

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3 className="modal-title">New Patient</h3>
        {err && <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>{err}</div>}
        {!link ? (
          <>
            <div className="form-group">
              <label className="label">Full Name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="form-group">
              <label className="label">Email</label>
              <input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="patient@email.com" type="email" />
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: "1.5rem" }}>
              A new patient intake link (GAD-7, PHQ-9, ASSIST, AUDIT-C) will be generated for you to share.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={!name || !email || saving} onClick={create}>
                {saving ? "Creating…" : "Create & Get Link"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="alert alert-info" style={{ marginBottom: "1rem" }}>
              Patient created! Share this link with {name}:
            </div>
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px",
              padding: "0.8rem", wordBreak: "break-all", fontSize: "0.82rem", color: "var(--accent)", marginBottom: "1.5rem" }}>
              {link}
            </div>
            <button className="btn btn-primary btn-full" onClick={() => navigator.clipboard?.writeText(link)}>
              Copy Link
            </button>
            <button className="btn btn-secondary btn-full" style={{ marginTop: "0.5rem" }} onClick={onClose}>Done</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── SEND ASSESSMENT MODAL ────────────────────────────────────────────────────
function SendAssessmentModal({ patient, onClose }) {
  const [selected, setSelected] = useState(["gad7"]);
  const [link, setLink] = useState(null);
  const [err, setErr] = useState("");
  const [generating, setGenerating] = useState(false);
  const toggleA = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const generate = async () => {
    setGenerating(true);
    setErr("");
    const sessionId = uid();
    const session = { id: sessionId, patientId: patient.id, patientName: patient.name,
      assessments: selected, createdAt: Date.now(), completed: false };
    const { error } = await supabase.from("sessions").upsert({ id: sessionId, data: session });
    if (error) {
      setGenerating(false);
      setErr(error.message || "Failed to create session.");
      return;
    }
    setLink(`${window.location.origin}${window.location.pathname}?patient=${sessionId}`);
    setGenerating(false);
  };

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3 className="modal-title">Send Assessment to {patient.name}</h3>
        {err && <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>{err}</div>}
        {!link ? (
          <>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>Select assessments to include:</p>
            <div style={{ display: "flex", flex: "wrap", gap: "0.5rem", marginBottom: "1.5rem" }}>
              {Object.values(ASSESSMENTS).map(a => (
                <button key={a.id} className={`filter-pill${selected.includes(a.id) ? " active" : ""}`}
                  onClick={() => toggleA(a.id)} style={{ borderColor: selected.includes(a.id) ? a.color : undefined, color: selected.includes(a.id) ? a.color : undefined }}>
                  {a.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={selected.length === 0 || generating} onClick={generate}>
                {generating ? "Generating…" : "Generate Link"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="alert alert-info">Link ready to share with {patient.name}:</div>
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px",
              padding: "0.8rem", wordBreak: "break-all", fontSize: "0.82rem", color: "var(--accent)", margin: "1rem 0" }}>
              {link}
            </div>
            <button className="btn btn-primary btn-full" onClick={() => navigator.clipboard?.writeText(link)}>Copy Link</button>
            <button className="btn btn-secondary btn-full" style={{ marginTop: "0.5rem" }} onClick={onClose}>Done</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── CLINICIAN DASHBOARD ──────────────────────────────────────────────────────
function ClinicianDashboard() {
  const [clinicianId, setClinicianId] = useState(null);
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [sendTo, setSendTo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setClinicianId(data?.user?.id ?? null);
    })();
  }, []);

  const refresh = useCallback(async () => {
    await seedDemoData(clinicianId);
    if (!clinicianId) {
      setPatients([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("patients")
      .select("id, name, email, created_at")
      .eq("clinician_id", clinicianId)
      .order("created_at", { ascending: true });
    if (!error && data) {
      const mapped = data.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      }));
      setPatients(mapped);
    } else {
      setPatients([]);
    }
    setLoading(false);
  }, [clinicianId]);

  useEffect(() => {
    if (clinicianId !== undefined) refresh();
  }, [clinicianId, refresh]);

  const selectedPatient = patients.find(p => p.id === selected);

  // Overview stats
  const [allResults, setAllResults] = useState({});
  useEffect(() => {
    (async () => {
      const out = {};
      for (const p of patients) {
        const { data, error } = await supabase
          .from("results")
          .select("data")
          .eq("patient_id", p.id);
        if (!error && data && data.length) {
          const list = data.map(row => row.data || {}).sort(
            (a, b) => (a.completedAt || 0) - (b.completedAt || 0)
          );
          out[p.id] = list[list.length - 1];
        }
      }
      setAllResults(out);
    })();
  }, [patients]);

  const alerts = patients.filter(p => {
    const r = allResults[p.id];
    return r && ((r.scores?.gad7 >= 10) || (r.scores?.phq9 >= 10));
  });

  return (
    <div>
      {!selectedPatient ? (
        <>
          {/* Header Banner */}
          <div className="dash-header" style={{ marginBottom: "1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", position: "relative", zIndex: 1 }}>
              <div>
                <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.9rem", color: "#E6EDF3", marginBottom: "0.3rem", lineHeight: 1.2 }}>
                  Patient Dashboard
                </h1>
                <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Longitudinal psychiatric monitoring & outcome tracking</p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowNew(true)} style={{ whiteSpace: "nowrap" }}>
                + New Patient
              </button>
            </div>
          </div>

          {/* Alert banner */}
          {alerts.length > 0 && (
            <div className="alert alert-warn" style={{ marginBottom: "1.5rem" }}>
              ⚠️ <strong>{alerts.length} patient{alerts.length > 1 ? "s" : ""}</strong> with elevated scores requiring follow-up: {alerts.map(p => p.name).join(", ")}
            </div>
          )}

          {/* Overview stats */}
          <div className="section-label" style={{ marginBottom: "0.75rem" }}>Overview</div>
          <div className="grid-4" style={{ marginBottom: "2rem" }}>
            <div className="stat-box stat-box-accent">
              <div className="stat-glow" style={{ background: "var(--accent)" }} />
              <div className="stat-val" style={{ color: "var(--accent)" }}>{patients.length}</div>
              <div className="stat-label">Total Patients</div>
            </div>
            <div className="stat-box stat-box-blue">
              <div className="stat-glow" style={{ background: "var(--blue)" }} />
              <div className="stat-val" style={{ color: "var(--blue)" }}>{Object.values(allResults).length}</div>
              <div className="stat-label">Assessments Completed</div>
            </div>
            <div className="stat-box stat-box-warn">
              <div className="stat-glow" style={{ background: "var(--warn)" }} />
              <div className="stat-val" style={{ color: "var(--warn)" }}>{alerts.length}</div>
              <div className="stat-label">Flagged for Follow-up</div>
            </div>
            <div className="stat-box stat-box-danger">
              <div className="stat-glow" style={{ background: "var(--danger)" }} />
              <div className="stat-val" style={{ color: "var(--danger)" }}>
                {Object.values(allResults).filter(r => r.scores?.phq9 >= 10).length}
              </div>
              <div className="stat-label">PHQ-9 Positive</div>
            </div>
          </div>

          {/* Patient list */}
          <div className="section-label" style={{ marginBottom: "0.75rem" }}>Patients</div>
          <div className="card">
            {loading && <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Loading…</p>}
            {!loading && patients.length === 0 && (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.3 }}>⊕</div>
                <p style={{ marginBottom: "1rem" }}>No patients yet.</p>
                <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>Add First Patient</button>
              </div>
            )}
            {patients.map(p => {
              const lr = allResults[p.id];
              const flagged = lr && ((lr.scores?.gad7 >= 10) || (lr.scores?.phq9 >= 10));
              return (
                <div key={p.id} className={`patient-row${selected === p.id ? " active" : ""}`} onClick={() => setSelected(p.id)}>
                  <div>
                    <div className="patient-name" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {p.name}
                      {flagged && <span className="badge" style={{ background: "rgba(248,113,113,0.15)", color: "var(--danger)", border: "1px solid rgba(248,113,113,0.3)", fontSize: "0.65rem" }}>⚠ Flagged</span>}
                    </div>
                    <div className="patient-meta">{p.email} · Added {fmtDate(p.createdAt)}</div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {lr && Object.entries(lr.scores || {}).slice(0, 2).map(([k, v]) => {
                      const def = ASSESSMENTS[k]; if (!def) return null;
                      const sev = def.severity(v);
                      return <span key={k} className="score-chip" style={{ color: sev.color, borderColor: `${sev.color}55` }}>{def.label}: {v}</span>;
                    })}
                    <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setSendTo(p); }}>Send Assessment</button>
                  </div>
                </div>
              );
            })}
          </div>

        </>
      ) : (
        <PatientDetail patient={selectedPatient} onBack={() => setSelected(null)} />
      )}

      {showNew && <NewPatientModal clinicianId={clinicianId} onClose={() => setShowNew(false)} onCreated={(p) => { refresh(); }} />}
      {sendTo && <SendAssessmentModal patient={sendTo} onClose={() => setSendTo(null)} />}
    </div>
  );
}

// ─── LOGIN MODAL ─────────────────────────────────────────────────────────────
function LoginModal({ onClose, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email || !pass) return;
    setLoading(true);
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      setError(error.message || "Unable to sign in. Please check your credentials.");
    } else if (data?.user) {
      onLoginSuccess(data.user);
    }
    setLoading(false);
  };

  return (
    <div className="login-modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="login-modal">
        <h2 className="login-title">Welcome back</h2>
        <p className="login-sub">Sign in to your PsyTrack clinician portal</p>
        <input
          className="login-input"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          className="login-input"
          type="password"
          placeholder="Password"
          value={pass}
          onChange={e => setPass(e.target.value)}
        />
        {error && (
          <p style={{ color: "#FCA5A5", fontSize: "0.8rem", marginTop: "0.25rem", marginBottom: "0.5rem" }}>
            {error}
          </p>
        )}
        <button
          className="home-btn-primary"
          style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem", borderRadius: "10px" }}
          disabled={!email || !pass || loading}
          onClick={handleSubmit}
        >
          {loading ? "Signing in…" : "Sign In →"}
        </button>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: "0.75rem",
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.3)",
            cursor: "pointer",
            fontSize: "0.82rem",
            fontFamily: "var(--font-body)",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
function HomePage({ user, onEnterPatient, onAbout, onOpenLogin, onSignOut, onGoClinician }) {

  const features = [
    { icon: "📊", title: "Longitudinal Tracking", desc: "Chart patient outcomes across validated assessments over time with rich visual graphs." },
    { icon: "🔔", title: "Automated Follow-ups", desc: "Smart scheduling triggers repeat assessments when clinical thresholds are met." },
    { icon: "📝", title: "Intervention Logging", desc: "Document clinical decisions at each data point to track treatment efficacy." },
  ];

  return (
    <>
      <div className="home-bg">
        <div className="home-orb home-orb-1" />
        <div className="home-orb home-orb-2" />
        <div className="home-orb home-orb-3" />
        <div className="home-noise" />
      </div>

      <div className="home-wrap">
        {/* Nav */}
        <nav className="home-nav">
          <div className="home-logo">PsyTrack</div>
          <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
            <button className="home-nav-link" onClick={onAbout}>About</button>
            <button className="home-nav-link">Research</button>
            {user ? (
              <>
                <button className="home-nav-link" onClick={onGoClinician}>Dashboard</button>
                <button className="home-nav-link" onClick={onSignOut}>Sign out</button>
              </>
            ) : (
              <button className="home-nav-link" onClick={onOpenLogin}>Sign In</button>
            )}
          </div>
        </nav>

        {/* Hero */}
        <section className="home-hero">
          <div className="home-eyebrow">
            <span className="home-eyebrow-dot" />
            Psychiatric Outcome Monitoring
          </div>

          <h1 className="home-h1">
            Data-driven care,<br /><em>beautifully simple</em>
          </h1>

          <p className="home-sub">
            PsyTrack delivers longitudinal, validated patient profiles to psychiatric practices — turning assessment data into actionable clinical insight.
          </p>

          <div className="home-actions">
            <button className="home-btn-primary" onClick={onOpenLogin}>
              {user ? "Go to Dashboard →" : "Clinician Portal →"}
            </button>
            <button className="home-btn-secondary" onClick={onEnterPatient}>
              Try Patient Demo
            </button>
          </div>
          {user && (
            <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "rgba(230,237,243,0.55)" }}>
              Signed in as <span style={{ color: "#E6EDF3", fontWeight: 600 }}>{user.email}</span>
            </p>
          )}

          {/* Feature strip */}
          <div className="home-features">
            {features.map((f, i) => (
              <div className="home-feature" key={i}>
                <span className="home-feature-icon">{f.icon}</span>
                <div className="home-feature-title">{f.title}</div>
                <div className="home-feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <footer className="home-footer">
          © 2026 PsyTrack · Built for psychiatric practice · Not a substitute for clinical judgment
        </footer>
      </div>

    </>
  );
}

function AboutPage({ onBack }) {
  const pillars = [
    { title: "Clinically grounded", desc: "Built around validated scales and longitudinal monitoring so clinicians can act on trends, not snapshots." },
    { title: "Fast to use", desc: "Designed for real workflows with clear dashboards, simple patient onboarding, and minimal clicks." },
    { title: "Privacy-minded", desc: "Local-first behavior in a normal browser, with a structure that’s ready to evolve into a secure production stack." },
  ];

  return (
    <>
      <div className="home-bg">
        <div className="home-orb home-orb-1" />
        <div className="home-orb home-orb-2" />
        <div className="home-orb home-orb-3" />
        <div className="home-noise" />
      </div>

      <div className="home-wrap">
        <nav className="home-nav">
          <button
            className="home-logo"
            onClick={onBack}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            PsyTrack
          </button>
          <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
            <button className="home-nav-link" onClick={onBack}>Home</button>
          </div>
        </nav>

        <section className="about-shell">
          <div className="about-title">About PsyTrack</div>
          <p className="about-sub">
            PsyTrack is a lightweight outcome-monitoring experience that helps translate validated assessment data into clear,
            trackable clinical insight over time.
          </p>

          <div className="about-grid">
            {pillars.map((p) => (
              <div className="about-card" key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="about-actions">
            <button className="about-back" onClick={onBack}>← Back to home</button>
          </div>
        </section>

        <footer className="home-footer">
          © 2026 PsyTrack · Built for psychiatric practice · Not a substitute for clinical judgment
        </footer>
      </div>
    </>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home"); // "home" | "about" | "clinician" | "patient"
  const [patientSession, setPatientSession] = useState(null);
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const screenRef = useRef(screen);
  const patientSessionRef = useRef(patientSession);
  const userRef = useRef(user);
  const homePinnedRef = useRef(false);
  const didAutoRouteRef = useRef(false);

  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { patientSessionRef.current = patientSession; }, [patientSession]);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("patient");
    if (p) { setPatientSession(p); setScreen("patient"); }
  }, []);

  useEffect(() => {
    document.body.style.background = (screen === "home" || screen === "about") ? "#05080F"
      : screen === "patient" ? "#F8FAFC" : "#0D1117";
  }, [screen]);

  const isPatient = screen === "patient";

  const maybeAutoRouteToClinician = useCallback((u) => {
    if (!u) return;
    if (patientSessionRef.current) return;
    if (homePinnedRef.current) return;
    if (didAutoRouteRef.current) return;
    if (screenRef.current !== "home" && screenRef.current !== "about") return;
    didAutoRouteRef.current = true;
    setScreen("clinician");
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const u = data?.user ?? null;
      setUser(u);
      setAuthReady(true);
      setShowLogin(false);
      maybeAutoRouteToClinician(u);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setAuthReady(true);
      if (u) {
        setShowLogin(false);
        maybeAutoRouteToClinician(u);
      } else {
        didAutoRouteRef.current = false;
        if (screenRef.current === "clinician") setScreen("home");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [maybeAutoRouteToClinician]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setShowLogin(false);
    homePinnedRef.current = false;
    didAutoRouteRef.current = false;
    if (screen === "clinician") setScreen("home");
  };

  const openLoginOrGoClinician = () => {
    if (userRef.current) {
      homePinnedRef.current = false;
      setShowLogin(false);
      setScreen("clinician");
      return;
    }
    setShowLogin(true);
  };

  if (screen === "home") {
    return (
      <>
        <style>{css}</style>
        <HomePage
          user={user}
          onEnterPatient={() => setScreen("patient")}
          onAbout={() => setScreen("about")}
          onOpenLogin={openLoginOrGoClinician}
          onSignOut={handleSignOut}
          onGoClinician={() => {
            homePinnedRef.current = false;
            setShowLogin(false);
            setScreen("clinician");
          }}
        />
        {showLogin && authReady && !user && !patientSession && (
          <LoginModal
            onClose={() => setShowLogin(false)}
            onLoginSuccess={(u) => {
              setUser(u);
              setShowLogin(false);
              didAutoRouteRef.current = true;
              setScreen("clinician");
            }}
          />
        )}
      </>
    );
  }

  if (screen === "about") {
    return (
      <>
        <style>{css}</style>
        <AboutPage onBack={() => setScreen("home")} />
        {showLogin && authReady && !user && !patientSession && (
          <LoginModal
            onClose={() => setShowLogin(false)}
            onLoginSuccess={(u) => {
              setUser(u);
              setShowLogin(false);
              didAutoRouteRef.current = true;
              setScreen("clinician");
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className={`app${isPatient ? " patient-theme" : ""}`}>
        <nav className="nav">
          <button
            onClick={() => {
              homePinnedRef.current = true;
              setShowLogin(false);
              setScreen("home");
            }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <div className="logo">Psy<span>Track</span></div>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {!patientSession && (
              <div className="nav-tabs">
                <button
                  className={`nav-tab${screen === "clinician" ? " active" : ""}`}
                  onClick={() => {
                    if (user) {
                      homePinnedRef.current = false;
                      setShowLogin(false);
                      setScreen("clinician");
                    } else {
                      setShowLogin(true);
                    }
                  }}
                >
                  Clinician Portal
                </button>
                <button className={`nav-tab${screen === "patient" ? " active" : ""}`} onClick={() => setScreen("patient")}>
                  Patient Demo
                </button>
              </div>
            )}
            {patientSession && <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Patient Assessment</span>}
            {user && !patientSession && (
              <button className="btn btn-secondary btn-sm" onClick={handleSignOut}>
                Sign out
              </button>
            )}
          </div>
        </nav>

        <main className="main">
          {screen === "clinician" && (user ? <ClinicianDashboard /> : null)}
          {screen === "patient" && (
            patientSession
              ? <PatientPortal sessionId={patientSession} />
              : <PatientPortalDemo />
          )}
        </main>
        {showLogin && authReady && !user && !patientSession && (
          <LoginModal
            onClose={() => setShowLogin(false)}
            onLoginSuccess={(u) => {
              setUser(u);
              setShowLogin(false);
              didAutoRouteRef.current = true;
              setScreen("clinician");
            }}
          />
        )}
      </div>
    </>
  );
}

// ─── PATIENT PORTAL DEMO (no URL param) ──────────────────────────────────────
function PatientPortalDemo() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [results, setResults] = useState({});
  const [done, setDone] = useState(false);

  const queue = ["gad7", "phq9", "assist", "auditc"];
  const current = queue[step];
  const def = ASSESSMENTS[current];
  const progress = (step / queue.length) * 100;

  const handleComplete = (answers, total) => {
    const newResults = { ...results, [current]: { answers, total } };
    setResults(newResults);
    if (step + 1 >= queue.length) setDone(true);
    else { setStep(s => s + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };

  if (done) {
    return (
      <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center", padding: "4rem 1rem" }}>
        <div style={{ fontSize: "3.5rem", marginBottom: "1.5rem" }}>✓</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", color: "var(--accent2)", marginBottom: "1rem" }}>Thank You</h2>
        <p style={{ color: "var(--muted)", lineHeight: "1.8", maxWidth: "400px", margin: "0 auto" }}>
          Your responses have been securely submitted. In a real session, your provider would now have access to your results.
        </p>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "1.5rem" }}>
          If you are in crisis, please call or text <strong style={{ color: "var(--text)" }}>988</strong>.
        </p>
        <button className="btn btn-secondary" style={{ marginTop: "2rem" }} onClick={() => { setStep(0); setResults({}); setDone(false); setStarted(false); }}>
          Restart Demo
        </button>
      </div>
    );
  }

  // ── Intro / welcome screen ──
  if (!started) {
    return (
      <div style={{ maxWidth: "620px", margin: "0 auto", padding: "3rem 1rem" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            background: "rgba(29,78,216,0.07)", border: "1px solid rgba(29,78,216,0.15)",
            borderRadius: "20px", padding: "0.35rem 1rem", marginBottom: "1.25rem",
            fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)", letterSpacing: "1px", textTransform: "uppercase"
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
            Patient Assessment Demo
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", color: "var(--text)", marginBottom: "0.75rem", lineHeight: 1.2 }}>
            Before we begin
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.7, maxWidth: "480px", margin: "0 auto" }}>
            This brief set of assessments helps your care team understand how you have been feeling recently. Your answers guide more personalized, effective treatment.
          </p>
        </div>

        {/* Info cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>

          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", background: "#FFFFFF",
            border: "1px solid var(--border)", borderRadius: "12px", padding: "1.1rem 1.25rem" }}>
            <span style={{ fontSize: "1.3rem", flexShrink: 0, marginTop: "0.1rem" }}>🔒</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)", marginBottom: "0.25rem" }}>Your responses are confidential</div>
              <div style={{ fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.6 }}>
                Only your treating clinician has access to your answers. Your information is never shared with third parties, employers, or insurers without your explicit consent.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", background: "#FFFFFF",
            border: "1px solid var(--border)", borderRadius: "12px", padding: "1.1rem 1.25rem" }}>
            <span style={{ fontSize: "1.3rem", flexShrink: 0, marginTop: "0.1rem" }}>📋</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)", marginBottom: "0.25rem" }}>What to expect</div>
              <div style={{ fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.6 }}>
                You will complete <strong style={{ color: "var(--text)" }}>4 short assessments</strong> covering mood, anxiety, and substance use. Most people finish in under 10 minutes. Answer based on how you have genuinely been feeling — there are no right or wrong answers.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", background: "#FFFFFF",
            border: "1px solid var(--border)", borderRadius: "12px", padding: "1.1rem 1.25rem" }}>
            <span style={{ fontSize: "1.3rem", flexShrink: 0, marginTop: "0.1rem" }}>💬</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)", marginBottom: "0.25rem" }}>How your results are used</div>
              <div style={{ fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.6 }}>
                Your clinician will review your responses before your appointment. This helps them spend more time on what matters most to you, rather than gathering basic information during your visit.
              </div>
            </div>
          </div>

        </div>

        {/* Crisis notice */}
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px",
          padding: "0.9rem 1.1rem", marginBottom: "2rem",
          fontSize: "0.82rem", color: "#991B1B", lineHeight: 1.6
        }}>
          <strong>If you are in crisis or experiencing a psychiatric emergency,</strong> please call or text{" "}
          <strong>988</strong> (Suicide & Crisis Lifeline) or go to your nearest emergency room. Do not wait for your clinician to follow up.
        </div>

        <button className="btn btn-primary btn-full" style={{ padding: "0.85rem", fontSize: "0.95rem", borderRadius: "10px" }}
          onClick={() => { setStarted(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          I understand — Begin Assessment →
        </button>

        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.75rem", marginTop: "1rem" }}>
          By continuing you confirm that you are completing this assessment for yourself.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto" }}>
      <div style={{ paddingTop: "1rem", paddingBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Assessment {step + 1} of {queue.length}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      {def && <AssessmentForm key={`demo-${def.id}-${step}`} def={def} onComplete={handleComplete} />}
    </div>
  );
}
