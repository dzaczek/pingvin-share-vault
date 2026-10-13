import {
  AuditLogFilter,
  AuditLogPage,
  ShardSummaryRow,
} from "../types/auditLog.type";
import api from "./api.service";

const list = async (filter: AuditLogFilter = {}): Promise<AuditLogPage> => {
  // empty strings would reach the backend as filters that match nothing
  const params = Object.fromEntries(
    Object.entries(filter).filter(([, v]) => v !== undefined && v !== ""),
  );
  return (await api.get("auditLogs", { params })).data;
};

const shards = async (): Promise<ShardSummaryRow[]> =>
  (await api.get("auditLogs/shards")).data;

export default { list, shards };
