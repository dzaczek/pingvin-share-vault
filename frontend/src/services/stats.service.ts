import { Stats } from "../types/stats.type";
import api from "./api.service";

const get = async (days: number): Promise<Stats> =>
  (await api.get("stats", { params: { days } })).data;

export default { get };
