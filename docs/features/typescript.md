# TypeScript features

As we mentioned the editor design revolves around giving you the best access to the TypeScript language service.

* [Syntax Highlighting](#syntax-highlighting)
* [Rename Refactoring](#rename-refactoring)
* [Tag, Bracket and Text matching](#matching)
* [Doctor](#doctor)
* [Go to Definition](#goto-definition)
* [Find References](#find-references)
* [JavaScript emit](#javascript-emit)

# Syntax Highlighting
Not just another text mate based grammar which [despite a lot of love](https://github.com/Microsoft/TypeScript-TmLanguage/blob/ab17d24fed148cd789fd632d74f170c7308d75ff/TypeScriptReact.tmLanguage) can still fall short. Compare:

### Textmate
![](https://raw.githubusercontent.com/alm-tools/alm-tools.github.io/master/screens/grammarBad.png)

### Us
![](https://raw.githubusercontent.com/alm-tools/alm-tools.github.io/master/screens/grammarGood.png)

This is because *we use the exact same code that TypeScript uses to carry out its blazing fast compile*. Also we give all the more love that we can.

![](https://raw.githubusercontent.com/alm-tools/alm-tools.github.io/master/screens/grammarLove.png)

# Rename Refactoring
Start a rename refactoring and we show you an easy to view list of things that will change.

![](https://raw.githubusercontent.com/alm-tools/alm-tools.github.io/master/screens/renameBig.gif)

And if its a local change we will even allow you to do it inline.

![](https://raw.githubusercontent.com/alm-tools/alm-tools.github.io/master/screens/renameSimple.gif)

# Matching
Matching tags and brackets and words are highlighted automatically, this means less searching, more doing

![](https://raw.githubusercontent.com/alm-tools/alm-tools.github.io/master/screens/matching.gif)

# Doctor
All the joys of inline information without the frustrations of keyboard shortcut, shifting text or dialog overloads. Toggle : `Ctrl|⌘ + '`

![](https://raw.githubusercontent.com/alm-tools/alm-tools.github.io/master/screens/doctor.png)

# Goto Definition

Easy as `Ctrl|⌘ + B`

![](https://raw.githubusercontent.com/alm-tools/alm-tools.github.io/master/screens/gotoDefinition.gif)

# Find References

Easy as `Ctrl|⌘ + Shift + B`

![](https://raw.githubusercontent.com/alm-tools/alm-tools.github.io/master/screens/findReferences.gif)


# JavaScript Emit

As soon as you edit a TypeScript file we do an intelligent emit of the expected JavaScript. We also to a full emit check whenever an active TypeScript project is set.

![](https://raw.githubusercontent.com/alm-tools/alm-tools.github.io/master/screens/emit.gif)
