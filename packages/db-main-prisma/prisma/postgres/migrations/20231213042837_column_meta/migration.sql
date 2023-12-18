/*
  Warnings:

  - You are about to drop the column `column_meta` on the `field` table. All the data in the column will be lost.
  - Added the required column `column_meta` to the `view` table without a default value. This is not possible if the table is not empty.

*/

begin;
-- Create a temporary table and convert the column column to a JSONB type
CREATE TEMP TABLE tmp AS
SELECT id, column_meta::jsonb FROM field;

-- AlterTable
ALTER TABLE "view" ADD COLUMN     "column_meta" TEXT NOT NULL DEFAULT '{}';

-- Update the column column of the view table WITH the WITH clause and LATERAL JOIN
WITH cet AS (
  SELECT v.id, jsonb_set(v.column_meta::jsonb, concat('{', t.id, '}')::text[], jsonb_build_object(k, v), true) AS column_meta
  FROM tmp t
  JOIN view v ON t.column_meta->v.id IS NOT NULL
  CROSS JOIN LATERAL jsonb_each(t.column_meta->v.id) AS x(k, v)
)

UPDATE view
SET column_meta = (
  SELECT jsonb_object_agg(key, value)::text AS column_meta
  FROM cet
  CROSS JOIN LATERAL jsonb_each(column_meta) AS x(key, value)
  WHERE view.id = cet.id
  GROUP BY id
);

-- AlterTable
ALTER TABLE "field" DROP COLUMN "column_meta";

commit;