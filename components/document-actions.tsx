import Link from "next/link";

type Props = { kind: "registry" | "knowledge"; id: string; className?: string };

export function DocumentActions({
  kind,
  id,
  className = "document-actions",
}: Props) {
  const preview =
    kind === "registry"
      ? `/api/documents/${id}/preview`
      : `/workspace/knowledge/${id}`;
  const download =
    kind === "registry"
      ? `${preview}?download=1`
      : `/api/knowledge/${id}/download`;
  return (
    <div className={className}>
      <Link href={preview} target="_blank" rel="noreferrer">
        Preview
      </Link>
      <a href={download}>Download</a>
    </div>
  );
}
