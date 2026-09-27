%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%% Template Cls ENEAM V.1.0 %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{ucao}[2026/04/16 v3.0]

\LoadClass[12pt,a4paper,oneside,openany]{report}

\RequirePackage[utf8]{inputenc}
\RequirePackage[french]{babel}
\RequirePackage{ifpdf}
\RequirePackage[x11names, dvipsnames, svgnames, table]{xcolor} % Better color management
\RequirePackage{textcomp}
\RequirePackage{etoolbox}
\RequirePackage{array}
\RequirePackage{titlesec} % For better title control
\RequirePackage{enumitem} % For better list control
\RequirePackage{booktabs} % Professional quality tables
\RequirePackage{tabularx} % Flexible column widths
\RequirePackage{multirow} % Multiple rows in tables
\RequirePackage{microtype} % Improves line breaking and spacing

\renewcommand{\thesection}{\thechapter.\arabic{section}}
 
\renewcommand{\thefigure}{\thechapter.\arabic{figure}}
\renewcommand{\thetable}{\thechapter.\arabic{table}}

\@addtoreset{figure}{chapter}
\@addtoreset{table}{chapter}

\setcounter{secnumdepth}{5}  % Numérotation jusqu'au niveau des subparagraphes
\setcounter{tocdepth}{5}

% --- Configuration des Tableaux Premium ---
\newcolumntype{L}{>{\raggedright\arraybackslash}X}
\newcolumntype{C}{>{\centering\arraybackslash}X}
\newcolumntype{R}{>{\raggedleft\arraybackslash}X}
\setlength{\heavyrulewidth}{1.5pt}
\setlength{\abovetopsep}{4pt}
% ------------------------------------------

\RequirePackage[T1]{fontenc}
\RequirePackage{charter}               % Elegant Serif for body (Modern Bitstream Charter)
\RequirePackage[charter]{mathdesign}   % Match math fonts to charter
\RequirePackage[scaled]{helvet}        % Clean Sans for titles
\RequirePackage{lmodern}


\RequirePackage{tikz}
\usetikzlibrary{calc, positioning, shapes.geometric}
\RequirePackage{fix-cm}
\RequirePackage{graphicx}				% pour insérer des images. Utiliser le format jpg pour plus de simplicité.
\RequirePackage{subcaption}             % Pour regrouper les images
\RequirePackage{placeins}               % Pour contrôler le placement des images (FloatBarrier)
\RequirePackage{array}
\RequirePackage{shorttoc}				% pour le sommaire, au début.
\RequirePackage{fancyhdr}				% afin de réaliser soi-même les en-têtes et pieds de page, voir chaque début de chapitre.
\RequirePackage{pifont}					% pour utiliser des symboles divers.

\RequirePackage[inner=30mm,outer=20mm,top=30mm,bottom=20mm,headheight=30pt]{geometry}



% Ou bien : \RequirePackage[top=4 cm, bottom=4 cm, left=3 cm, right=3 cm]{geometry} % on peut modifier ces valeurs pour augmenter ou réduire les marges. Attention aux en-têtes de chapitres. 

\RequirePackage{setspace} % permet d'utiliser les commandes \spacing, doublespace (double interligne), singlespace (simple interligne) et onehalfspace (un interligne et demi)

\RequirePackage{hyperref} % utiliser pour une bibliographie interactive + sommaire et TOC interactifs (pour une sortie PDF, par exemple).
\hypersetup{
    colorlinks=true, 
    citecolor=black, 
    filecolor=black, 
    linkcolor=black, 
    urlcolor=techBlue,
    hypertexnames=false, % Fix duplicate destination warnings
    breaklinks=true      % Handle long links correctly
}

% A ajouter dans hypersetup pour plus de visibilité dans les propriétés du document
%pdftitle={titre du document}, pdfauthor={auteur}, pdfcreator={PdfLaTeX}, pdfkeywords={mots-clé}, pdfsubject={sujet du document}

\RequirePackage{framed} % utilise pour coloriser les encarts
\RequirePackage{color} % pour les couleurs

\onehalfspacing % Interligne 1,5

\RequirePackage{ifthen} % Entrer valeurs booléennes et autres options

\RequirePackage{csquotes} % Assurer les guillemets français
\frenchspacing
\FrenchFootnotes

% Override French babel's small-caps formats and declare missing font shape
\AtBeginDocument{%
  \DeclareFontShape{T1}{lmr}{m}{fsc}{<->ssub*lmr/m/sc}{}%
  \renewcommand{\fnum@table}{\textbf{\tablename~\thetable}}%
  \renewcommand{\fnum@figure}{\textbf{\figurename~\thefigure}}%
}




%%%%%%%%%%%%%% En-tête de chapitre %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Les lignes suivantes définissent l'esthétique des débuts de chapitre.
% Cette séquence a été récupérée sur Internet, créateur inconnu...
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

% Modern Chapter Headings
\makeatletter
\def\@makechapterhead#1{%
  \vspace*{20\p@}
  {\parindent \z@ \raggedright \normalfont
    \ifnum \c@secnumdepth >\m@ne
      \if@mainmatter
        \begin{tikzpicture}[remember picture,overlay]
          \node[anchor=north east, xshift=-1cm, yshift=-1cm, opacity=0.1, font=\sffamily\bfseries\fontsize{120}{120}\selectfont] at (current page.north east) {\thechapter};
        \end{tikzpicture}
        \sffamily\Large\bfseries\color{ucaoBlue} \MakeUppercase{\@chapapp}\ \thechapter
        \par\nobreak
        \vskip 10\p@
      \fi
    \fi
    \interlinepenalty\@M
    \huge \bfseries \color{premiumGray} #1\par\nobreak
    \vskip 10\p@
    \color{ucaoRed}\hrule height 2pt width 5cm \relax
    \vskip 40\p@
  }}

\def\@makeschapterhead#1{%
  \vspace*{20\p@}
  {\parindent \z@ \raggedright \normalfont
    \interlinepenalty\@M
    \huge \bfseries \color{ucaoBlue} #1\par\nobreak
    \vskip 10\p@
    \color{ucaoRed}\hrule height 2pt width 5cm \relax
    \vskip 40\p@
  }}

%%%%%%%%%%%%%%%%%%%% Fin en-tête de chapitre %%%%%%%%%%%%%%%%%%%


%%%%%%%%%%% Tête de parties %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\makeatletter
\newcommand*{\jolipart}[1]{%
	\begin{center}
		\begin{Huge}\color{black}
			#1
		\end{Huge}
		\end{center}
		\vspace{1cm}
	\begin{center}
%\begin{Huge}
		%\ding{167}
	%\end{Huge}
	\hrulefill
	\end{center}
	}


% Manually handle Part styling since we removed sectsty to avoid conflicts
\makeatletter
\def\@part[#1]#2{%
    \ifnum \c@secnumdepth >-2\relax
      \refstepcounter{part}%
      \addcontentsline{toc}{part}{\thepart\hspace{1em}#1}%
    \else
      \addcontentsline{toc}{part}{#1}%
    \fi
    \markboth{}{}%
    {\centering
     \interlinepenalty \@M
     \normalfont
     \ifnum \c@secnumdepth >-2\relax
       \huge\bfseries \partname\nobreakspace\thepart
        \par\medskip
     \fi
     \jolipart{#2}\par}%
    \@endpart}

\def\@spart#1{%
    {\centering
     \interlinepenalty \@M
     \normalfont
     \jolipart{#1}\par}%
    \@endpart}

\raggedbottom


%%%%%%%%%%%%%%%% COULEURS %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\definecolor{ucaoBlue}{RGB}{26, 35, 126}      % Navy Blue (UCAO primary)
\definecolor{ucaoRed}{RGB}{136, 14, 79}       % Dark Red (UCAO secondary)
\definecolor{techBlue}{RGB}{0, 105, 192}     % Tech Blue
\definecolor{soyGreen}{RGB}{46, 125, 50}      % Agricultural Green
\definecolor{premiumGray}{RGB}{66, 66, 66}    % Professional Gray
\definecolor{lightGray}{RGB}{245, 245, 245}   % Background/Subtle Gray
\definecolor{ucaoVeryLightBlue}{RGB}{232, 234, 246} % Very Light Blue for tables
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Configuration des listes à puces (Premium)
% Utilisation de enumitem pour forcer les puces (bullets)
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\setlist[itemize,1]{label=\color{ucaoRed}$\bullet$}
\setlist[itemize,2]{label=\color{ucaoBlue}\small$\bullet$}
\setlist[itemize,3]{label=\color{techBlue}\scriptsize$\bullet$}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Style personnalisé pour la liste des sigles
\newlist{sigleslist}{description}{1}
\setlist[sigleslist]{
    leftmargin=3.5cm, 
    labelwidth=3cm, 
    labelsep=0.5cm, 
    font=\bfseries,
    itemsep=0.5ex
}

% Application sécurisée des deux-points après le sigle
\AtBeginEnvironment{sigleslist}{%
  \renewcommand{\descriptionlabel}[1]{\bfseries #1~:}%
}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

% Commande pour le numéro de page (version impression sans couleur)
\newcommand{\pagenumberbadge}{%
  \textbf{\thepage}%
}

%%%%%%%%%%%%%%%%%% RÉGLAGE DE LA BIBLIOGRAPHIE %%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%% ATTENTION, on utilise Biblatex %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\RequirePackage[style=ieee,sorting=none,defernumbers=true,hyperref,backend=biber]{biblatex}
% simplement compiler avec $biber nomdufichier (sans le .tex). Si vous voulez
% en rester à bibtex,il vous suffit de placer backend=bibtex.

% La ressource biblio est maintenant déclarée dans main.tex
\defbibheading{primary}{\section*{Sources primaires}} % Catégorie (sous forme de section) pour le tri de la bibliographie.

\defbibheading{secondary}{\section*{Sources secondaires}} % Catégorie (sous forme de section) pour le tri de la bibliographie.

\renewcommand*{\newunitpunct}{\addcomma\space} % Virgule entre les parties d'une référence (merci a Josquin Debaz)

%%%% Ajustements pour la bibliographie
%\DeclareFieldFormat[article]{volume}{\textbf{#1}}  %Le numéro de volume en gras
\DeclareFieldFormat[article]{number}{\textit{#1}} %Le numéro dans le volume en italique
%\DeclareFieldFormat{pages}{page(s): #1} % page(s) en toutes lettres, si on veut...

% \renewcommand{\mkibid}[1]{\emph{#1}} % Inutile en style numérique

% Et pour mettre le in en italique dans la référence biblio (merci encore à Josquin Debaz)
\DefineBibliographyStrings{french}{%
	in = {\emph{in}}%
}


%%%%%%%%%%%%%%%%%% Interligne simple pour citations et vers %%%%%%%%%
%% Environnements: QUOTE, QUOTATION, VERSE
% Copyright (C) 2002 Mike Nolta <mrnolta@princeton.edu>, GPL V. 2.0 and
% later version. http://www.physics.princeton.edu/cosmology/computing/PrincetonThesis.cls
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%
\let\orig@quote\quote
\let\endorig@quote\endquote
\renewenvironment*{quote}
	{\begin{orig@quote}\begin{singlespace}}
	{\end{singlespace}\end{orig@quote}}

\let\old@quotation\quotation
\let\endold@quotation\endquotation
\renewenvironment*{quotation}
	{\begin{old@quotation}\begin{singlespace}}
		{\end{singlespace}\end{old@quotation}}

\let\old@verse\verse
\let\endold@verse\endverse
\renewenvironment*{verse}
	{\begin{old@verse}\begin{singlespace}}
		{\end{singlespace}\end{old@verse}}

%%%%%%%%%%%%%%%% TITRE THESE PAGE DE GARDE %%%%%%%%%%%%%%%%

%logo université

\newcommand*{\logouniversite}[1]{\gdef\@logouniversite{#1}}
\logouniversite{}

\newcommand*{\scalelogouniversite}[1]{\gdef\@scalelogouniversite{#1}}
\scalelogouniversite{}

% Logo ecole
\newcommand*{\logoecole}[1]{\gdef\@logoecole{#1}}
\logoecole{}

\newcommand*{\scalelogoecole}[1]{\gdef\@scalelogoecole{#1}}
\scalelogoecole{}

% Cycle
\newcommand*{\cycle}[1]{\gdef\@cycle{#1}}
\cycle{}

% Nom de l'université
\newcommand*{\nomdeuniversite}[1]{\gdef\@nomdeuniversite{#1}}
\nomdeuniversite{Université Catholique de l'Afrique de l'Ouest}

%%%% FIlière
\newcommand{\filiere}[1]{\gdef\@filiere{#1}}
\filiere{}

%%%% option
\newcommand{\option}[1]{\gdef\@option{#1}}
\option{}

%%%% Nom du maitre de mémoire
\newcommand{\maitrememoire}[1]{\gdef\@maitrememoire{#1}}
\maitrememoire{}

%%%% Titre du directeur de thèse
\newcommand{\titremaitrememoire}[1]{\gdef\@titremaitrememoire{#1}}
\titremaitrememoire{}

%%%% Nom du maitre de stage
\newcommand{\maitrestage}[1]{\gdef\@maitrestage{#1}}
\maitrestage{}

%%%% Titre du directeur de thèse
\newcommand{\titremaitrestage}[1]{\gdef\@titremaitrestage{#1}}
\titremaitrestage{}

%%%% Jury
\newcommand{\jury}[1]{\gdef\@jury{#1}}
\jury{}

%%%% Laboratoire / départment / unité
\newcommand{\unite}[1]{\gdef\@unite{#1}}
\unite{}

%%%%% École doctorale
\newcommand{\ecoledoc}[1]{\gdef\@ecoledoc{#1}}
\ecoledoc{}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%mise en page de la page de garde
\def\maketitle{%
  \thispagestyle{empty}
  \clearpage
  \begin{tikzpicture}[remember picture,overlay]
    % Clean Sidebar Accent
    \fill[ucaoBlue] (current page.north west) rectangle ([xshift=1.2cm]current page.south west);
    \fill[ucaoRed] ([xshift=1.3cm]current page.north west) rectangle ([xshift=1.35cm]current page.south west);
    
    % Logos
    \node[anchor=west, xshift=1.5cm, yshift=-2.2cm] at (current page.north west) {
      \ifx\@logouniversite\@empty\else
        \includegraphics[width=2.5cm, height=2.2cm, keepaspectratio]{\@logouniversite}
      \fi
    };
    \node[anchor=east, xshift=-1.5cm, yshift=-2.2cm] at (current page.north east) {
      \ifx\@logoecole\@empty\else
        \includegraphics[width=4.5cm, height=3.5cm, keepaspectratio]{\@logoecole}
      \fi
    };

    % Main Content Area
    \node[anchor=north, yshift=-2.0cm] at (current page.north) {
      \parbox{14cm}{
        \begin{center}
          \sffamily\color{premiumGray}
          {\large \textbf{RÉPUBLIQUE DU BÉNIN}} \\[0.1cm]
          {\footnotesize MINISTÈRE DE L'ENSEIGNEMENT SUPÉRIEUR ET DE LA RECHERCHE SCIENTIFIQUE} \\[0.3cm]
          {\normalsize \textbf{\@nomdeuniversite}} \\[0.05cm]
          {\footnotesize \textbf{École de Génie Électrique et Informatique}} \\[0.05cm]
		  {\footnotesize \textbf{(EGEI)}} \\[0.3cm]
          
          {\color{ucaoRed}\rule{2cm}{1.5pt}} \\[0.3cm]
          {\Large \textbf{MÉMOIRE DE FIN DE CYCLE}} \\[0.05cm]
          {\small Pour l'obtention du diplôme de} \\[0.05cm]
          {\large \textbf{\@cycle}} \\[0.2cm]
          {\small Domaine : \textbf{\@filiere}} \\[0.05cm]
          {\small Filière : \textbf{\@option}} \\[0.4cm]
          {\color{ucaoRed}\rule{10cm}{0.8pt}} \\[0.3cm]
          
          \begin{minipage}{14cm}
            \centering
            {\LARGE \color{ucaoBlue} \bfseries \@title}
          \end{minipage} \\[0.4cm]
          
          {\color{ucaoRed}\rule{10cm}{0.8pt}}
        \end{center}
        
        \vspace{0.3cm}
        
        \begin{minipage}[t]{0.45\textwidth}
          \sffamily\color{premiumGray}
          \textbf{Présenté par :}\\[0.2cm]
          \begin{tabular}{@{\color{ucaoRed}$\bullet$~} >{\normalsize\bfseries\color{premiumGray}}l}
             \noalign{\global\let\oldand\and \gdef\and{\\ }}
             \@author \\
             \noalign{\global\let\and\oldand}
          \end{tabular}
        \end{minipage}
        \hfill
        \begin{minipage}[t]{0.52\textwidth}
          \sffamily\color{premiumGray}\raggedleft
          {\color{ucaoBlue}\textbf{Sous la direction de :}} \\[0.05cm]
          {\normalsize \textbf{\@maitrememoire}, \@titremaitrememoire} \\[0.3cm]
          {\color{ucaoBlue}\textbf{Co-encadré par :}} \\[0.05cm]
          {\normalsize \@maitrestage} \\
          {\scriptsize \@titremaitrestage}
        \end{minipage}

        \vspace{0.4cm}

        %\begin{center}
        %  \sffamily\color{premiumGray}
        %  {\footnotesize \textbf{Composition du Jury}} \\[0.1cm]
        %  {\color{ucaoRed}\rule{4cm}{1.5pt}} \\[0.4cm]
        %  \begin{minipage}{12.5cm}
        %     \centering\footnotesize
        %     \renewcommand{\descriptionlabel}[1]{\hspace{\labelsep}\color{ucaoBlue}\textbf{##1}}
        %     \@jury
        %  \end{minipage}
        %\end{center}

        \vspace{0.4cm}
        
        \begin{center}
          \sffamily
          {\color{ucaoRed}\rule{4cm}{1.2pt}} \\[0.2cm]
          \setlength{\fboxsep}{6pt}
          \color{ucaoRed}\fcolorbox{ucaoRed}{white}{\color{premiumGray}\small\textbf{\@date}}
        \end{center}
      }
    };
  \end{tikzpicture}
  \newpage
}


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%% En-têtes %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


%%%%%%%%% Pour supprimer les en-têtes et pied de page gênants par exemple juste avant un chapitre sur une page de droite
\newcommand{\clearemptydoublepage}{%
\newpage{\pagestyle{empty}\cleardoublepage}}
%%%% ... et utiliser la commande \clearemptydoublepage juste avant le \chapter


\fancyhf{}	% on annule le fancy automatique

% Redéfinir le style plain pour que les débuts de chapitres aient aussi le badge
\fancypagestyle{plain}{%
  \fancyhf{}
  \fancyfoot[C]{\pagenumberbadge}
  \renewcommand{\headrulewidth}{0pt}
}


%%%%%%%%%% Gérer les en-têtes dans les frontmatter mainmatter et backmatter

\RequirePackage{etoolbox}

% Définition des structures manquantes pour la classe report
\newcommand{\frontmatter}{\clearpage\pagenumbering{roman}}
\newcommand{\mainmatter}{\clearpage\pagenumbering{arabic}}
\newcommand{\backmatter}{\clearpage}

\appto\frontmatter{\pagestyle{fancy}
  \renewcommand{\sectionmark}[1]{}
  \renewcommand{\chaptermark}[1]{\markboth{\textit{#1}}{}}
  \fancyfoot[C]{\pagenumberbadge}
  \fancyhead[LE,RO]{}
  \fancyhead[RE,LO]{}
  \renewcommand{\headrulewidth}{0pt}
}

\appto\mainmatter{\pagestyle{fancy}
  \renewcommand{\sectionmark}[1]{\markright{\textit{\thesection.\ #1}}}
  \renewcommand{\chaptermark}[1]{\markboth{\chaptername~\thechapter~--\ \textit{#1}}{}}
  \fancyhead[LE,RO]{}
  \fancyhead[RO]{\small\rightmark}
  \fancyhead[LE]{\small \leftmark}
  \fancyfoot[C]{\pagenumberbadge}
  \renewcommand{\headrulewidth}{0.5pt}
  \renewcommand{\headrule}{{\color{black}\hrule height \headrulewidth width \headwidth \vskip-\headrulewidth}}
}

\appto\backmatter{\pagestyle{fancy}
  \renewcommand{\sectionmark}[1]{\markright{\thesection.\ #1}}
  \renewcommand{\chaptermark}[1]{\markboth{\chaptername~\thechapter~--\ #1}{}}
  \fancyhead[LE,RO]{}
  \fancyhead[RO]{}
  \fancyhead[LE]{}
  \fancyfoot[C]{\pagenumberbadge}
  \renewcommand{\headrulewidth}{0pt}
}


%%%%%%%%%%%%%% FAIRE DES ENCARTS %%%%%%%%%%%%%%%%%%%%%%%%%%
% Couleurs :

\definecolor{fondtitre}{RGB}{85,85,85}
\definecolor{fonddeboite}{RGB}{232,232,232}
\definecolor{shadecolor}{RGB}{232,232,232}

\ProcessOptions

%%%%%%%%%% Boitemagique  %%%%%%%%%%%%%%%%%%%%%%%%%%
\newcommand*{\boitemagique}[2]{
\begin{center}
\begin{tikzpicture}
% la boite
\node[rectangle, draw=ucaoBlue, fill=lightGray, inner sep=15pt, rounded corners=5pt, line width=1pt] (mabox)
{
\begin{minipage}{0.85\textwidth}
\color{premiumGray}#2
\end{minipage}
};
% le titre de la boite
\node[fill=ucaoBlue, text=white, rectangle, rounded corners=2pt, inner sep=5pt] at (mabox.north) {\sffamily\small\bfseries #1};
\end{tikzpicture}
\end{center}
}

%%%%%% boitesimple %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\newcommand*{\boitesimple}[1]{%
\begin{center}
\fcolorbox{ucaoRed}{lightGray}{
\begin{minipage}{0.85\textwidth}
\vspace{5pt}
#1
\vspace{5pt}
\end{minipage}
}
\end{center}
}
