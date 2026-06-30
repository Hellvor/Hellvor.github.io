# How exactly is this done?
A Chroma++ program is, at its core, raw pixel data. A cursor reads the program left to right, top to bottom, and gets the rgb values of each pixel. The cursor starts in Structure mode, with R = Operation, eg: Get, Loop, Hold, ect, G = Values ahead that determine the input, eg, 3 means the next 3 colour values, so one pixel, and B = Output, eg Print, Draw, ect. After reading a valid Function Pixel, the cursor goes into Builder mode, in which the number of values decided by the G channel are treated as input values for the Function Pixels.

For example, let's look at the most well-known program across all coding languages: the humble "Hello World!"

# Hello Chroma!
Normally, to write the string "Hello Chroma!" to the Multitool, you'd write:
```lua
print("Hello Chroma!")
```
However, we're using Chroma++, so the string "Hello Chroma!" would be drawn in the Multitool as:

![Seemingly empty space](./images/HelloWorld.png)

Pretty hard to see, eh? well, here's the scaled up version:

![Oh, it's some pixels!](./images/HelloChroma.png)

As you can see, simply printing the string "Hello Chroma!" is shrunken into just six pixels, making the important bits of the file just over 69 Bytes. Nice! (due to how storage works with files under 150 bytes, a computer will show it as being 4.0kb)