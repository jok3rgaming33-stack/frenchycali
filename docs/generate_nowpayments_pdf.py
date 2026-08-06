"""Génère le PDF guide NOWPayments style Heisenweb (fond noir, accents lime)."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
import shutil

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    Flowable,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

OUT = Path(__file__).resolve().parent / "FrenchyCali_NOWPayments_Guide_Activation.pdf"
COPIES = [
    Path(r"C:\Users\djedu\Desktop\FrenchyCali_NOWPayments_Guide_Activation.pdf"),
    Path(r"D:\DOWNLOAD\FrenchyCali_NOWPayments_Guide_Activation.pdf"),
]

BG = HexColor("#0a0a0a")
CARD = HexColor("#141414")
ROW_ALT = HexColor("#121212")
LIME = HexColor("#c8ff00")
TEXT = HexColor("#e8e8e8")
MUTED = HexColor("#9a9a9a")
BORDER = HexColor("#2a2a2a")
AMBER = HexColor("#fbbf24")

W, H = A4
MARGIN = 18 * mm


class RoundedCard(Flowable):
    def __init__(self, content_flowables, width, padding=12, border_lime=False, fill=None):
        super().__init__()
        self.content = content_flowables
        self.box_width = width
        self.padding = padding
        self.border_lime = border_lime
        self.fill = fill or CARD
        self._heights = []

    def wrap(self, availWidth, availHeight):
        w = min(self.box_width, availWidth)
        max_h = 0
        heights = []
        for f in self.content:
            _fw, fh = f.wrap(w - 2 * self.padding, availHeight)
            heights.append((f, fh))
            max_h += fh + 4
        self._heights = heights
        self.width = w
        self.height = max_h + 2 * self.padding - 4
        return w, self.height

    def draw(self):
        c = self.canv
        r = 10
        c.saveState()
        c.setFillColor(self.fill)
        c.roundRect(0, 0, self.width, self.height, r, fill=1, stroke=0)
        c.setStrokeColor(LIME if self.border_lime else BORDER)
        c.setLineWidth(1.5 if self.border_lime else 0.6)
        c.roundRect(0, 0, self.width, self.height, r, fill=0, stroke=1)
        y = self.height - self.padding
        for f, fh in self._heights:
            y -= fh
            f.drawOn(c, self.padding, y)
            y -= 4
        c.restoreState()


def make_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="Brand",
            fontName="Helvetica",
            fontSize=9,
            textColor=LIME,
            alignment=TA_CENTER,
            spaceAfter=6,
            leading=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            fontName="Helvetica-Bold",
            fontSize=22,
            textColor=LIME,
            alignment=TA_CENTER,
            spaceAfter=6,
            leading=28,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSub",
            fontName="Helvetica",
            fontSize=11,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=8,
            leading=15,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1",
            fontName="Helvetica-Bold",
            fontSize=14,
            textColor=LIME,
            alignment=TA_LEFT,
            spaceBefore=12,
            spaceAfter=8,
            leading=18,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2",
            fontName="Helvetica-Bold",
            fontSize=11,
            textColor=LIME,
            alignment=TA_LEFT,
            spaceBefore=8,
            spaceAfter=5,
            leading=14,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            fontName="Helvetica",
            fontSize=9.5,
            textColor=TEXT,
            alignment=TA_LEFT,
            spaceAfter=3,
            leading=13,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Step",
            fontName="Helvetica",
            fontSize=9.5,
            textColor=TEXT,
            alignment=TA_LEFT,
            leftIndent=8,
            spaceAfter=2,
            leading=13,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Muted",
            fontName="Helvetica",
            fontSize=8.5,
            textColor=MUTED,
            alignment=TA_LEFT,
            spaceAfter=3,
            leading=11,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Mono",
            fontName="Courier",
            fontSize=8.5,
            textColor=LIME,
            alignment=TA_LEFT,
            spaceAfter=2,
            leading=11,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CardTitle",
            fontName="Helvetica-Bold",
            fontSize=10,
            textColor=LIME,
            alignment=TA_LEFT,
            spaceAfter=6,
            leading=13,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CenterMuted",
            fontName="Helvetica",
            fontSize=8.5,
            textColor=MUTED,
            alignment=TA_CENTER,
            leading=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CenterBody",
            fontName="Helvetica",
            fontSize=9.5,
            textColor=TEXT,
            alignment=TA_CENTER,
            leading=13,
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Th",
            fontName="Helvetica-Bold",
            fontSize=8.5,
            textColor=LIME,
            alignment=TA_LEFT,
            leading=11,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Td",
            fontName="Helvetica",
            fontSize=8.5,
            textColor=TEXT,
            alignment=TA_LEFT,
            leading=11,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TdMuted",
            fontName="Helvetica",
            fontSize=8.5,
            textColor=MUTED,
            alignment=TA_LEFT,
            leading=11,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Warn",
            fontName="Helvetica",
            fontSize=9,
            textColor=AMBER,
            alignment=TA_LEFT,
            spaceAfter=4,
            leading=12,
        )
    )
    return styles


def paint_bg(c, _doc):
    c.saveState()
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.restoreState()


def paint_footer(c, doc):
    # Ne pas repeindre le fond ici (sinon ça masque le contenu déjà dessiné).
    c.saveState()
    c.setStrokeColor(LIME)
    c.setLineWidth(1.2)
    y = 14 * mm
    c.line(MARGIN, y + 6, W - MARGIN, y + 6)
    c.setFont("Helvetica", 7.5)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, y - 2, "Heisenweb  ·  FrenchyCali — Guide activation NOWPayments")
    c.drawRightString(W - MARGIN, y - 2, f"{doc.page}")
    c.restoreState()


def P(text, style):
    return Paragraph(text, style)


def mini_card(title, body, col_w, styles):
    data = [[P(f"<b>{title}</b>", styles["CardTitle"])], [P(body, styles["Muted"])]]
    t = Table(data, colWidths=[col_w - 8])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CARD),
                ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return t


def build():
    styles = make_styles()
    content_w = W - 2 * MARGIN
    tw = content_w
    story = []

    # Cover
    story.append(Spacer(1, 28 * mm))
    story.append(P("HEISENWEB  ×  FRENCHYCALI", styles["Brand"]))
    story.append(Spacer(1, 4 * mm))
    story.append(P("GUIDE D'ACTIVATION", styles["CoverTitle"]))
    story.append(P("NOWPAYMENTS + VERCEL", styles["CoverTitle"]))
    story.append(Spacer(1, 3 * mm))
    story.append(
        P(
            "Paiement multi-crypto clé en main — configuration propriétaire / admin",
            styles["CoverSub"],
        )
    )
    story.append(
        HRFlowable(width="40%", thickness=2, color=LIME, spaceBefore=4, spaceAfter=16, hAlign="CENTER")
    )
    story.append(Spacer(1, 8 * mm))

    meta = [
        P("Projet : <b>FrenchyCali</b> (frenchycali-full)", styles["CenterBody"]),
        P("Domaine : frenchycali-full.vercel.app", styles["CenterBody"]),
        P(
            f"Document : activation gateway NOWPayments · {datetime.now().strftime('%B %Y')}",
            styles["CenterBody"],
        ),
        P(
            "Sans ces clés, le site fonctionne <b>exactement comme avant</b> (aucune casse).",
            styles["CenterBody"],
        ),
    ]
    story.append(RoundedCard(meta, content_w, padding=14))
    story.append(Spacer(1, 8 * mm))

    highlight = [
        P("OBJECTIF", styles["CardTitle"]),
        P(
            "Activer le bouton <b>« Payer en crypto »</b> après commande, avec choix multi-crypto "
            "(BTC, ETH, XMR, USDT…) géré par NOWPayments, et confirmation auto via webhook IPN.",
            styles["Body"],
        ),
    ]
    story.append(RoundedCard(highlight, content_w, padding=14, border_lime=True))
    story.append(Spacer(1, 10 * mm))

    col_w = (content_w - 12) / 3
    row = Table(
        [
            [
                mini_card(
                    "1 · NOWPayments",
                    "Compte, wallets, API key, IPN secret & callback",
                    col_w,
                    styles,
                ),
                mini_card(
                    "2 · Vercel",
                    "Variables d'env + Redeploy production",
                    col_w,
                    styles,
                ),
                mini_card(
                    "3 · Admin FC",
                    "Interrupteur Paiements crypto + test commande",
                    col_w,
                    styles,
                ),
            ]
        ],
        colWidths=[col_w, col_w, col_w],
    )
    row.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(row)

    story.append(PageBreak())

    # A
    story.append(P("A. NOWPAYMENTS — COMPTE ET CLÉS", styles["H1"]))
    story.append(P("Dashboard merchant · wallets · API · IPN", styles["Muted"]))

    story.append(
        RoundedCard(
            [
                P("A1 · Créer le compte", styles["CardTitle"]),
                P("1. Ouvre <font color='#c8ff00'>https://nowpayments.io/</font>", styles["Step"]),
                P("2. Clique <b>Sign up</b> / <b>Get started</b>", styles["Step"]),
                P("3. Valide l'email", styles["Step"]),
                P("4. Connecte-toi au <b>Dashboard</b>", styles["Step"]),
            ],
            content_w,
            padding=12,
        )
    )
    story.append(Spacer(1, 4 * mm))

    story.append(
        RoundedCard(
            [
                P("A2 · Wallets de réception", styles["CardTitle"]),
                P("1. Menu latéral → <b>Settings</b> (ou Payouts / Wallets)", styles["Step"]),
                P("2. Ajoute au minimum les wallets à accepter :", styles["Step"]),
                P("• Bitcoin (BTC)", styles["Step"]),
                P("• Ethereum (ETH) — <b>mainnet</b>", styles["Step"]),
                P("• Monero (XMR)", styles["Step"]),
                P("• évent. USDT (choisis <b>un</b> réseau clairement)", styles["Step"]),
                P("3. Enregistre / vérifie chaque adresse", styles["Step"]),
            ],
            content_w,
            padding=12,
        )
    )
    story.append(Spacer(1, 4 * mm))

    story.append(
        RoundedCard(
            [
                P("A3 · API Key", styles["CardTitle"]),
                P("1. Menu → <b>Settings → API keys</b> (parfois Payments → API)", styles["Step"]),
                P("2. Clique <b>Create API key</b> / Generate", styles["Step"]),
                P("3. Copie la clé dans un gestionnaire de mots de passe", styles["Step"]),
                P(
                    "→ Variable Vercel : <font color='#c8ff00'><b>NOWPAYMENTS_API_KEY</b></font>",
                    styles["Mono"],
                ),
                P("4. <b>Ne la commit jamais</b> dans Git", styles["Warn"]),
            ],
            content_w,
            padding=12,
        )
    )
    story.append(Spacer(1, 4 * mm))

    story.append(
        RoundedCard(
            [
                P("A4 · IPN Secret (callback)", styles["CardTitle"]),
                P("1. Toujours dans <b>Settings / API / IPN</b>", styles["Step"]),
                P("2. Génère ou affiche le <b>IPN Secret</b>", styles["Step"]),
                P("3. Copie-le", styles["Step"]),
                P(
                    "→ Variable Vercel : <font color='#c8ff00'><b>NOWPAYMENTS_IPN_SECRET</b></font>",
                    styles["Mono"],
                ),
            ],
            content_w,
            padding=12,
        )
    )
    story.append(Spacer(1, 4 * mm))

    story.append(
        RoundedCard(
            [
                P("A5 · URL de callback IPN", styles["CardTitle"]),
                P("1. Champ <b>IPN callback URL</b> / Notification URL", styles["Step"]),
                P("2. Colle <b>exactement</b> :", styles["Step"]),
                P("https://frenchycali-full.vercel.app/api/crypto/ipn", styles["Mono"]),
                P("3. Sauvegarde", styles["Step"]),
                P(
                    "Si ton domaine custom change, mets https://TON-DOMAINE/api/crypto/ipn "
                    "et aligne NEXT_PUBLIC_SITE_URL sur le même domaine.",
                    styles["Muted"],
                ),
            ],
            content_w,
            padding=12,
            border_lime=True,
        )
    )
    story.append(Spacer(1, 4 * mm))

    story.append(
        RoundedCard(
            [
                P("A6 · Coins activés  ·  A7 · Sécurité compte", styles["CardTitle"]),
                P(
                    "• Section <b>Currencies / Coins</b> → active BTC, ETH, XMR (+ autres si besoin)",
                    styles["Step"],
                ),
                P("• Désactive ce que tu ne veux pas afficher au client", styles["Step"]),
                P(
                    "• Active la <b>2FA</b> (authenticator) sur le compte NOWPayments",
                    styles["Step"],
                ),
                P("• Email de récupération pro · ne partage jamais l'API key", styles["Step"]),
            ],
            content_w,
            padding=12,
        )
    )

    story.append(PageBreak())

    # B Vercel
    story.append(P("B. VERCEL — VARIABLES D'ENVIRONNEMENT", styles["H1"]))
    story.append(P("Project settings · redeploy obligatoire", styles["Muted"]))

    story.append(
        RoundedCard(
            [
                P("B1 · Ouvrir le projet", styles["CardTitle"]),
                P("1. Va sur <font color='#c8ff00'>https://vercel.com/</font>", styles["Step"]),
                P("2. Projet <b>frenchycali-full</b> (team heisen-web-s-projects)", styles["Step"]),
                P("3. Onglet <b>Settings</b>", styles["Step"]),
            ],
            content_w,
            padding=12,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(P("B2 · Environment Variables", styles["H2"]))
    story.append(
        P(
            "Menu gauche → <b>Environment Variables</b> · ajoute une par une, puis Save.",
            styles["Body"],
        )
    )

    header = [
        P("<b>Name</b>", styles["Th"]),
        P("<b>Value</b>", styles["Th"]),
        P("<b>Environments</b>", styles["Th"]),
    ]
    rows_data = [
        header,
        [
            P("NOWPAYMENTS_API_KEY", styles["Td"]),
            P("clé API dashboard", styles["TdMuted"]),
            P("Production (+ Preview)", styles["TdMuted"]),
        ],
        [
            P("NOWPAYMENTS_IPN_SECRET", styles["Td"]),
            P("secret IPN", styles["TdMuted"]),
            P("Production (+ Preview)", styles["TdMuted"]),
        ],
        [
            P("NEXT_PUBLIC_SITE_URL", styles["Td"]),
            P("https://frenchycali-full.vercel.app", styles["TdMuted"]),
            P("Production", styles["TdMuted"]),
        ],
    ]
    tbl = Table(rows_data, colWidths=[tw * 0.34, tw * 0.36, tw * 0.30])
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#1f1f1f")),
                ("BACKGROUND", (0, 1), (-1, 1), CARD),
                ("BACKGROUND", (0, 2), (-1, 2), ROW_ALT),
                ("BACKGROUND", (0, 3), (-1, 3), CARD),
                ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(tbl)
    story.append(Spacer(1, 4 * mm))

    story.append(
        RoundedCard(
            [
                P("REDEPLOY OBLIGATOIRE", styles["CardTitle"]),
                P(
                    "Après ajout des variables : <b>Deployments</b> → ⋮ sur le dernier déploiement → <b>Redeploy</b>.",
                    styles["Body"],
                ),
                P(
                    "Sinon les nouvelles variables ne sont pas chargées et le gateway reste « non configuré ».",
                    styles["Muted"],
                ),
            ],
            content_w,
            padding=12,
            border_lime=True,
        )
    )
    story.append(Spacer(1, 4 * mm))

    story.append(
        RoundedCard(
            [
                P("B3 · Vérifier le deploy", styles["CardTitle"]),
                P("1. Deployment status = <b>Ready</b>", styles["Step"]),
                P("2. Ouvre le site prod", styles["Step"]),
                P(
                    "3. Admin → <b>Paiements crypto</b> : le bandeau doit indiquer que c'est <b>configuré</b>",
                    styles["Step"],
                ),
            ],
            content_w,
            padding=12,
        )
    )

    story.append(Spacer(1, 8 * mm))
    story.append(P("C. FRENCHYCALI ADMIN — INTERRUPTEUR", styles["H1"]))
    story.append(
        RoundedCard(
            [
                P("Activation dans le panel", styles["CardTitle"]),
                P("1. Connecte-toi sur <font color='#c8ff00'>/admin</font>", styles["Step"]),
                P("2. Onglet <b>Paiements crypto</b>", styles["Step"]),
                P("3. Coche <b>Activer le paiement crypto au checkout</b>", styles["Step"]),
                P("4. <b>Enregistrer</b>", styles["Step"]),
                P(
                    "Si le switch est grisé : les clés Vercel ne sont pas vues (redeploy manquant ou mauvaise env).",
                    styles["Warn"],
                ),
            ],
            content_w,
            padding=12,
            border_lime=True,
        )
    )

    story.append(PageBreak())

    # D + E + F
    story.append(P("D. TEST DE BOUT EN BOUT", styles["H1"]))
    story.append(P("Validation complète du parcours client → admin", styles["Muted"]))
    story.append(
        RoundedCard(
            [
                P("Checklist test", styles["CardTitle"]),
                P("1. Compte client sur une boutique (31 / 94 / Delivery)", styles["Step"]),
                P("2. Passe une petite commande", styles["Step"]),
                P(
                    "3. Écran <b>Commande passée</b> → bouton <b>Payer en crypto</b>",
                    styles["Step"],
                ),
                P("4. Page NOWPayments → choisis une crypto (ou annule)", styles["Step"]),
                P(
                    "5. Admin → <b>Récap commandes</b> → colonne / filtre <b>Paiement</b> :",
                    styles["Step"],
                ),
                P("   En attente → puis <b>Payé</b> après IPN", styles["Step"]),
                P(
                    "6. Fil messagerie client : message de confirmation quand payé",
                    styles["Step"],
                ),
                P(
                    "7. Mobile : cartes récap avec badge paiement + filtre Non payées",
                    styles["Step"],
                ),
            ],
            content_w,
            padding=12,
        )
    )
    story.append(Spacer(1, 6 * mm))

    story.append(P("E. DÉPANNAGE", styles["H1"]))
    e_header = [
        P("<b>Symptôme</b>", styles["Th"]),
        P("<b>Cause probable</b>", styles["Th"]),
        P("<b>Action</b>", styles["Th"]),
    ]
    e_rows = [
        e_header,
        [
            P("Pas de bouton « Payer en crypto »", styles["Td"]),
            P("Clés absentes / switch off / pas redeploy", styles["TdMuted"]),
            P("Vérifier env + admin + Redeploy", styles["TdMuted"]),
        ],
        [
            P("IPN jamais reçu", styles["Td"]),
            P("Mauvaise URL / secret", styles["TdMuted"]),
            P("Vérifier /api/crypto/ipn + IPN_SECRET", styles["TdMuted"]),
        ],
        [
            P("Signature invalid (logs)", styles["Td"]),
            P("Secret incorrect", styles["TdMuted"]),
            P("Recopier IPN secret, redeploy", styles["TdMuted"]),
        ],
        [
            P("Invoice error", styles["Td"]),
            P("API key / compte non validé", styles["TdMuted"]),
            P("Dashboard NOWPayments, support", styles["TdMuted"]),
        ],
        [
            P("Colonne Paiement vide", styles["Td"]),
            P("Anciennes commandes", styles["TdMuted"]),
            P("Normal ; seulement après activation", styles["TdMuted"]),
        ],
    ]
    et = Table(e_rows, colWidths=[tw * 0.32, tw * 0.34, tw * 0.34])
    et.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#1f1f1f")),
                ("BACKGROUND", (0, 1), (-1, 1), CARD),
                ("BACKGROUND", (0, 2), (-1, 2), ROW_ALT),
                ("BACKGROUND", (0, 3), (-1, 3), CARD),
                ("BACKGROUND", (0, 4), (-1, 4), ROW_ALT),
                ("BACKGROUND", (0, 5), (-1, 5), CARD),
                ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(et)

    story.append(Spacer(1, 8 * mm))
    story.append(P("F. OÙ VOIR LE STATUT DANS L'ADMIN", styles["H1"]))
    story.append(
        RoundedCard(
            [
                P("Emplacements UI", styles["CardTitle"]),
                P(
                    "1. <b>Récap commandes</b> → colonne Paiement + filtres (Non payées, Payées…)",
                    styles["Step"],
                ),
                P("2. <b>Détail commande</b> (Voir) → bandeau paiement en haut", styles["Step"]),
                P(
                    "3. <b>Commandes en cours / Locker / Messagerie</b> → ligne sous le total",
                    styles["Step"],
                ),
                P("4. Mobile : cartes avec badge En attente / Payé / …", styles["Step"]),
            ],
            content_w,
            padding=12,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(
        RoundedCard(
            [
                P("Statuts affichés", styles["CardTitle"]),
                P("• <b>En attente</b> — invoice créée, pas encore payée", styles["Step"]),
                P("• <b>Partiel</b> — montant incomplet", styles["Step"]),
                P("• <b>Payé</b> — confirmé par webhook IPN", styles["Step"]),
                P("• <b>Échoué / Expiré</b> — échec ou délai dépassé", styles["Step"]),
                P("• <b>—</b> / Sans crypto — pas de gateway (legacy ou off)", styles["Step"]),
            ],
            content_w,
            padding=12,
            border_lime=True,
        )
    )

    story.append(Spacer(1, 8 * mm))
    story.append(P("SÉCURITÉ (RAPPEL)", styles["H1"]))
    story.append(
        RoundedCard(
            [
                P("Rappels sécurité client / admin", styles["CardTitle"]),
                P(
                    "• Clés API et IPN secret : <b>serveur only</b> (Vercel env), jamais dans Git ni le navigateur",
                    styles["Step"],
                ),
                P(
                    "• Webhook signé HMAC-SHA512 — IPN rejeté sans secret valide",
                    styles["Step"],
                ),
                P(
                    "• Montant € calculé serveur à la commande, pas inventé par le front",
                    styles["Step"],
                ),
                P("• 2FA obligatoire sur le compte NOWPayments", styles["Step"]),
                P(
                    "• Le client paie sur l'infra NOWPayments (pas de CB stockée sur FrenchyCali)",
                    styles["Step"],
                ),
            ],
            content_w,
            padding=12,
        )
    )

    story.append(Spacer(1, 10 * mm))
    story.append(HRFlowable(width="100%", thickness=1.2, color=LIME, spaceBefore=4, spaceAfter=8))
    story.append(
        P(
            "Heisenweb × FrenchyCali  ·  Document technique d'activation  ·  Confidentiel client",
            styles["CenterMuted"],
        )
    )
    story.append(
        P(
            "Source markdown : docs/nowpayments-activation.md  ·  Code : app/actions/crypto-payment.ts",
            styles["CenterMuted"],
        )
    )

    class BlackDoc(SimpleDocTemplate):
        def beforePage(self):
            self.canv.saveState()
            self.canv.setFillColor(BG)
            self.canv.rect(0, 0, W, H, fill=1, stroke=0)
            self.canv.restoreState()

    doc = BlackDoc(
        str(OUT),
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title="FrenchyCali — Guide activation NOWPayments",
        author="Heisenweb",
    )
    doc.build(story, onFirstPage=paint_footer, onLaterPages=paint_footer)

    for dest in COPIES:
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(OUT, dest)
            print("copied", dest)
        except Exception as e:
            print("copy fail", dest, e)
    print("OK", OUT, OUT.stat().st_size)


if __name__ == "__main__":
    build()
