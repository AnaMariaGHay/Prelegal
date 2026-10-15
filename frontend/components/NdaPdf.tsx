import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  ATTRIBUTION,
  COVER_PAGE_INTRO,
  SIGNING_STATEMENT,
  coverAnchor,
  type CoverPage,
  type FieldValue,
} from "@/lib/nda";
import type { Block, Run } from "@/lib/standardTerms";

// PDF counterpart of NdaPreview, built from the same cover page and Standard
// Terms model. Uses the built-in Times fonts, so no font files are needed.

const styles = StyleSheet.create({
  page: { paddingVertical: 60, paddingHorizontal: 64, fontFamily: "Times-Roman", fontSize: 11, lineHeight: 1.4 },
  title: { fontFamily: "Times-Bold", fontSize: 18, textAlign: "center", marginBottom: 14 },
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
  clause: { marginTop: 7, textAlign: "justify" },
  bold: { fontFamily: "Times-Bold" },
  link: { color: "#075985" },
});

function Value({ value }: { value: FieldValue }) {
  return <Text style={value.missing ? styles.missing : undefined}>{value.text}</Text>;
}

function Runs({ runs }: { runs: Run[] }) {
  return runs.map((run, i) => {
    if (run.bold) return <Text key={i} style={styles.bold}>{run.text}</Text>;
    if (run.href)
      return (
        <Link key={i} src={run.href} style={styles.link}>
          {run.text}
        </Link>
      );
    if (run.coverPageTerm)
      return (
        <Link key={i} src={`#${coverAnchor(run.text)}`} style={styles.link}>
          {run.text}
        </Link>
      );
    return run.text;
  });
}

export function NdaPdf({ cover, terms }: { cover: CoverPage; terms: Block[] }) {
  return (
    <Document title="Mutual Non-Disclosure Agreement" creator="Prelegal">
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Mutual Non-Disclosure Agreement</Text>
        <Text>{COVER_PAGE_INTRO}</Text>

        {cover.sections.map((section) => (
          <View key={section.title} id={coverAnchor(section.title)} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.hint && <Text style={styles.hint}>{section.hint}</Text>}
            {section.lines.map((line, i) => (
              <Text key={i}>
                {line.label && `${line.label}: `}
                <Value value={line} />
              </Text>
            ))}
          </View>
        ))}

        <View wrap={false}>
          <Text style={{ marginTop: 16 }}>{SIGNING_STATEMENT}</Text>
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.cell, styles.labelCell]} />
              <Text style={[styles.cell, styles.headerCell]}>PARTY 1</Text>
              <Text style={[styles.cell, styles.headerCell]}>PARTY 2</Text>
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
          <Text style={styles.small}>{ATTRIBUTION}</Text>
        </View>

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
              <Text key={i} style={styles.clause}>
                {block.number}. <Runs runs={block.runs} />
              </Text>
            );
          return (
            <Text key={i} style={styles.small}>
              <Runs runs={block.runs} />
            </Text>
          );
        })}
      </Page>
    </Document>
  );
}
