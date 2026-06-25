import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const streamApi = createApi({
  reducerPath: "streamApi",
  baseQuery: fetchBaseQuery({
    baseUrl:
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/",
  }),
  endpoints: (builder) => ({
    getSchedule: builder.query({
      query: () => "/api/schedule",
    }),
  }),
});

export const { useGetScheduleQuery } = streamApi;
