import React, { useState } from "react";
import { X, Sigma, FlaskConical, Scroll, Shuffle } from "lucide-react";

export default ({ onClose, onSave }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("sigma");

  const generateCode = (prefix) => {
    const p = prefix.slice(0, 3).toUpperCase().padEnd(3, "X");
    const rNum = Math.floor(100 + Math.random() * 899);
    return `${p}-${rNum}Z`;
  };

  const [inviteCode, setInviteCode] = useState(generateCode("CLX"));

  const randomizeCode = () => {
    setInviteCode(generateCode(name || "CLX"));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name, description, invite_code: inviteCode, icon });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in select-none">
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-6 shadow-xl relative bg-white border-[#eae7e4] text-[#1c1b1a]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight">Create Classroom</h2>
          <p className="text-xs mt-0.5 text-zinc-500">
            Bootstrap a new active study workspace environment.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-sans">
          <div className="space-y-1.5">
            <label className="text-2xs font-mono uppercase tracking-wider text-zinc-400 block">
              Classroom/Course Title
            </label>
            <input
              type="text"
              className="w-full rounded-xl border px-4 py-2.5 text-xs focus:ring-1 focus:outline-none transition-all duration-200 bg-[#fdfaf7] border-[#d4d2d0] text-zinc-900 placeholder:text-zinc-400 focus:border-[#4a7c59] focus:ring-[#4a7c59]"
              placeholder="e.g. Chemistry Basics, Math 101"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.length > 2) {
                  setInviteCode(generateCode(e.target.value));
                }
              }}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-2xs font-mono uppercase tracking-wider text-zinc-400 block">
              Description
            </label>
            <textarea
              className="w-full rounded-xl border px-4 py-2.5 text-xs focus:ring-1 focus:outline-none transition-all duration-200 bg-[#fdfaf7] border-[#d4d2d0] text-zinc-900 placeholder:text-zinc-400 focus:border-[#4a7c59] focus:ring-[#4a7c59]"
              placeholder="Brief description of this classroom"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-2xs font-mono uppercase tracking-wider text-zinc-400 block">
              Invite Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-xl border px-4 py-2.5 text-xs focus:outline-none font-mono font-bold uppercase tracking-wider bg-[#fdfaf7] border-[#d4d2d0] text-[#4a7c59]"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                required
              />
              <button
                type="button"
                onClick={randomizeCode}
                className="p-2.5 rounded-xl border flex items-center justify-center cursor-pointer transition-colors border-[#eae7e4] hover:bg-zinc-50 text-zinc-500 bg-white"
                title="Randomize Code"
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-2xs font-mono uppercase tracking-wider text-zinc-400 block">
              Subject Emblem
            </label>
            <div className="flex items-center gap-3">
              {["sigma", "flask", "scroll"].map((iconOpt) => (
                <button
                  key={iconOpt}
                  type="button"
                  onClick={() => setIcon(iconOpt)}
                  className={`flex-1 flex items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${
                    icon === iconOpt
                      ? "bg-green-100/20 border-[#4a7c59] text-[#4a7c59] font-bold"
                      : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-white"
                  }`}
                >
                  {iconOpt === "sigma" && <Sigma className="w-4 h-4" />}
                  {iconOpt === "flask" && <FlaskConical className="w-4 h-4" />}
                  {iconOpt === "scroll" && <Scroll className="w-4 h-4" />}
                  <span className="text-2xs font-mono uppercase ml-1.5 leading-none">{iconOpt}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              onClick={onClose}
              type="button"
              className="flex-1 py-2.5 px-4 text-xs font-semibold rounded-xl border cursor-pointer transition-colors border-[#eae7e4] hover:bg-zinc-50 text-zinc-500 bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 py-2.5 px-4 text-xs font-semibold rounded-xl text-white cursor-pointer transition-all duration-200 bg-[#4a7c59] hover:bg-[#32533c] disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              Create Classroom
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
