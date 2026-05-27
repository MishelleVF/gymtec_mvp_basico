const API_URL =
  process.env.NEXT_PUBLIC_GYMTEC_API_URL || "http://127.0.0.1:8000";

export type OccupancyLevel = "bajo" | "medio" | "alto" | "critico" | "desconocido";

export type PredictionRow = {
  fecha: string;
  dia: string;
  dia_num: number;
  slot: string;
  hora_dec: number;
  aforo_predicho: number;
  aforo_max: number;
  ratio_ocupacion_predicho: number;
  nivel_ocupacion: OccupancyLevel;
};

export type BusySlot = {
  dia: string;
  slot: string;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Error API ${res.status}: ${path}`);
  }

  return res.json();
}

export async function getHealth() {
  return request<{ status: string; service: string; version: string }>("/health");
}

export async function getPredictions(dia?: string) {
  const query = dia ? `?dia=${encodeURIComponent(dia)}` : "";
  return request<PredictionRow[]>(`/predictions${query}`);
}

export async function getTodayPredictions() {
  return request<PredictionRow[]>("/predictions/today");
}

export async function getCurrentOccupancy() {
  return request("/occupancy/current");
}

export async function getHeatmap() {
  return request<{
    dias: string[];
    slots: string[];
    matriz: number[][];
  }>("/occupancy/heatmap");
}

export async function getLowOccupancy(dia: string, top = 5) {
  return request<PredictionRow[]>(
    `/low-occupancy?dia=${encodeURIComponent(dia)}&top=${top}`
  );
}

export async function getRecommendationsByCourses(params: {
  studentId: string;
  cursos: string[];
  topN?: number;
}) {
  return request("/recommendations", {
    method: "POST",
    body: JSON.stringify({
      student_id: params.studentId,
      cursos: params.cursos,
      top_n: params.topN ?? 3,
    }),
  });
}

export async function recommendByBusySchedule(
  busySlots: BusySlot[],
  topN = 3
) {
  const predictions = await getPredictions();

  const busySet = new Set(
    busySlots.map((slot) => `${slot.dia}|${slot.slot}`)
  );

  return predictions
    .filter((row) => !busySet.has(`${row.dia}|${row.slot}`))
    .sort((a, b) => {
      const ratioA =
        a.ratio_ocupacion_predicho ?? a.aforo_predicho / a.aforo_max;
      const ratioB =
        b.ratio_ocupacion_predicho ?? b.aforo_predicho / b.aforo_max;

      return ratioA - ratioB;
    })
    .slice(0, topN)
    .map((row, index) => ({
      ranking: index + 1,
      dia: row.dia,
      slot: row.slot,
      aforoPredicho: row.aforo_predicho,
      aforoMax: row.aforo_max,
      ratio: row.ratio_ocupacion_predicho,
      nivel: row.nivel_ocupacion,
      razon: `Recomendado porque estás libre y el aforo esperado es ${row.nivel_ocupacion} (${row.aforo_predicho}/${row.aforo_max} personas).`,
    }));
}