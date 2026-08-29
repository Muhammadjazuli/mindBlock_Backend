"use client";

import React from "react";
import { Puzzle, puzzleDescription } from "@/lib/types/puzzles";

interface PuzzleInfoCardProps {
  puzzle: Puzzle;
}

const difficultyConfig = {
  BEGINNER: { color: "bg-emerald-500/20 text-emerald-400", stars: "★☆☆" },
  INTERMEDIATE: { color: "bg-yellow-500/20 text-yellow-400", stars: "★★☆" },
  ADVANCED: { color: "bg-orange-500/20 text-orange-400", stars: "★★★" },
  EXPERT: { color: "bg-rose-500/20 text-rose-400", stars: "★★★" },
  ALL: { color: "bg-slate-500/20 text-slate-400", stars: "☆☆☆" },
  easy: { color: "bg-emerald-500/20 text-emerald-400", stars: "★☆☆" },
  medium: { color: "bg-yellow-500/20 text-yellow-400", stars: "★★☆" },
  hard: { color: "bg-rose-500/20 text-rose-400", stars: "★★★" },
};

const typeConfig = {
  logic: { icon: "🧠", label: "Logic Puzzle" },
  coding: { icon: "💻", label: "Coding Challenge" },
  blockchain: { icon: "⛓️", label: "Blockchain" },
};

export default function PuzzleInfoCard({ puzzle }: PuzzleInfoCardProps) {
  const difficulty = (puzzle.difficulty || "BEGINNER") as keyof typeof difficultyConfig;
  const type = (puzzle.type || "logic") as keyof typeof typeConfig;
  const diffConfig = difficultyConfig[difficulty] ?? difficultyConfig.BEGINNER;
  const typeConfig_ = typeConfig[type] ?? typeConfig.logic;
  const pointsReward = puzzle.points || 10;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-8 space-y-6">
      {/* Description */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Description
        </h2>
        <p className="text-base text-slate-300 leading-relaxed">
          {puzzleDescription(puzzle)}
        </p>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {/* Type */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Type
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xl">{typeConfig_.icon}</span>
            <span className="font-semibold text-slate-200">
              {typeConfig_.label}
            </span>
          </div>
        </div>

        {/* Difficulty */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Difficulty
          </p>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-bold ${diffConfig.color}`}
            >
              {diffConfig.stars}
            </span>
            <span className="capitalize font-semibold text-slate-200">
              {difficulty}
            </span>
          </div>
        </div>

        {/* Time Limit */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Time Limit
          </p>
          <p className="font-semibold text-slate-200">
            {puzzle.timeLimit ? `${puzzle.timeLimit} mins` : "No limit"}
          </p>
        </div>

        {/* Points Reward */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            XP Reward
          </p>
          <p className="font-semibold text-yellow-400">+{pointsReward} XP</p>
        </div>
      </div>

      {/* Category Badge */}
      {puzzle.categoryId && (
        <div className="pt-4 border-t border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Category
          </p>
          <span className="inline-block px-4 py-2 bg-blue-500/20 text-blue-300 rounded-full text-sm font-semibold">
            {puzzle.categoryId}
          </span>
        </div>
      )}
    </div>
  );
}
