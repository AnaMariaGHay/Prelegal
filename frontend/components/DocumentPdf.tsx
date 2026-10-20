import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PARTIES_ANCHOR, type CoverPage, type FieldValue } from "@/lib/documents";
import type { Block, Run } from "@/lib/standardTerms";

// PDF counterpart of DocumentPreview, built from the same cover page and Standard Terms
// model. Uses the built-in Times fonts, so no font files are needed.

const styles = StyleSheet.create({
  page: { paddingTop: 60, paddingBottom: 64, paddingHorizontal: 64, fontFamily: "Times-Roman", fontSize: 11, lineHeight: 1.4 },
  title: { fontFamily: "Times-Bold", fontSize: 18, textAlign: "center" },
  subtitle: { fontSize: 9, textAlign: "center", color: "#555", marginBottom: 14 },
  section: { marginTop: 8 },
  sectionTitle: { fontFamily: "Times-Bold", fontSize: 12 },
  hint: { fontFamily: "Times-Italic", fontSize: 9, color: "#555" },
  missing: { backgroundColor: "#fef3c7", color: "#92400e" },
  table: { marginTop: 8, borderTopWidth: 1, borderLeftWidth: 1, borderColor: "#999" },
  row: { flexDirection: "row" },
  cell: { flex: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#999", padding: 4, minHeight: 20 },
  labelCell: { flex: 0.9, fontFamily: "Times-Bold" },
  headerCell: { fontFamily: "Times-Bold", textAlign: "center" },
  small: { fontSize: 8, color: "#555", marginTop: 10 },
  termsTitle: { fontFamily: "Times-Bold", fontSize: 16, textAlign: "center", marginBottom: 8 },
  clause: { textAlign: "justify" },
  paragraph: { marginTop: 7 },
  bold: { fontFamily: "Times-Bold" },
  link: { color: "#075985" },
  footer: { position: "absolute", bottom: 28, left: 64, right: 64, fontSize: 8, color: "#555", textAlign: "center" },
});

function PageFooter({ title }: { title: string }) {
  return (
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) => `${title} · Page ${pageNumber} of ${totalPages}`}
    />
  );
}

function Value({ value }: { value: FieldValue }) {
  return <Text style={value.missing ? styles.missing : undefined}>{value.text}</Text>;
}

function Runs({ runs, anchorFor }: { runs: Run[]; anchorFor: (term: string) => string | undefined }) {
  return runs.map((run, i) => {
    const style = run.bold ? styles.bold : undefined;
    const anchor = run.term && anchorFor(run.term);
    const src = run.href ?? (anchor ? `#${anchor}` : undefined);
    if (src)
      return (
        <Link key={i} src={src} style={[styles.link, ...(style ? [style] : [])]}>
          {run.text}
        </Link>
      );
    return (
      <Text key={i} style={style}>
        {run.text}
      </Text>
    );
  });
}

type Props = { cover: CoverPage; terms: Block[]; anchorFor: (term: string) => string | undefined };

export function DocumentPdf({ cover, terms, anchorFor }: Props) {
  return (
    <Document title={cover.title} creator="Prelegal">
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>{cover.title}</Text>
        <Text style={styles.subtitle}>{cover.coverTitle.toUpperCase()}</Text>
        <Text>{cover.intro}</Text>

        {cover.sections.map((section) => (
          <View key={section.anchor} id={section.anchor} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Value value={section.value} />
          </View>
        ))}

        <View wrap={false}>
          <Text style={{ marginTop: 16 }}>{cover.signingStatement}</Text>
          <View id={PARTIES_ANCHOR} style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.cell, styles.labelCell]} />
              {cover.partyHeaders.map((header) => (
                <Text key={header} style={[styles.cell, styles.headerCell]}>
                  {header}
                </Text>
              ))}
            </View>
            {cover.partyRows.map((row) => (
              <View key={row.label} style={styles.row}>
                <View style={[styles.cell, styles.labelCell]}>
                  <Text>{row.label}</Text>
                  {row.hint && <Text style={styles.hint}>{row.hint}</Text>}
                </View>
                {row.values.map((v, i) => (
                  <View key={i} style={[styles.cell, row.label === "Signature" ? { minHeight: 32 } : {}]}>
                    <Value value={v} />
                  </View>
                ))}
              </View>
            ))}
          </View>
          <Text style={styles.small}>{cover.attribution}</Text>
        </View>
        <PageFooter title={cover.title} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        {terms.map((block, i) => {
          if (block.kind === "heading")
            return (
              <Text key={i} style={styles.termsTitle}>
                {block.text}
              </Text>
            );
          if (block.kind === "clause")
            return (
              <Text
                key={i}
                style={[styles.clause, { marginTop: block.level === 0 ? 10 : 5, paddingLeft: block.level * 18 }]}
              >
                {block.label} <Runs runs={block.runs} anchorFor={anchorFor} />
              </Text>
            );
          return (
            <Text key={i} style={styles.paragraph}>
              <Runs runs={block.runs} anchorFor={anchorFor} />
            </Text>
          );
        })}
        <PageFooter title={cover.title} />
      </Page>
    </Document>
  );
}
