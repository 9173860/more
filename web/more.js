define(function(require, exports) {
	var CssLexer = require('./lexer/CssLexer'),
		CssRule = require('./lexer/rule/CssRule'),
		Token = require('./lexer/Token'),
		Parser = require('./parser/Parser'),
		Node = require('./parser/Node'),
		character = require('./util/character'),
		res,
		node,
		token,
		index,
		stack;

	function init(ignore) {
		res = '';
		index = 0;
		while(ignore[index]) {
			if(ignore[index].type() == Token.IGNORE) {
				res += ignore[index].content().replace(/\S/g, ' ');
			}
			else {
				res += ignore[index].content();
			}
			index++;
		}
		stack = [];
	}
	function join(node, ignore, inHead, isSelectors, isSelector) {
		var isToken = node.name() == Node.TOKEN,
			isVirtual = isToken && node.token().type() == Token.VIRTUAL;
		if(isToken) {
			if(!isVirtual) {
				var token = node.token();
				if(inHead) {
					res += token.content();
				}
				else if(isSelectors || isSelector) {
					var temp = stack[stack.length - 1];
					if(isSelectors) {
						temp.push('');
					}
					else {
						temp[temp.length - 1] += token.content();
					}
				}
				else {
					res += token.content();
				}
				while(ignore[++index]) {
					var ig = ignore[index];
					var s = ig.type() == Token.IGNORE ? ig.content().replace(/\S/g, ' ') : ig.content();
					if(!inHead && (isSelectors || isSelector)) {
						var temp = stack[stack.length - 1];
						temp[temp.length - 1] += s;
					}
					else {
						res += s;
					}
				}
			}
		}
		else {
			if(!inHead && [Node.FONTFACE, Node.MEDIA, Node.CHARSET, Node.IMPORT, Node.PAGE, Node.KEYFRAMES].indexOf(node.name()) != -1) {
				inHead = true;
			}
			//���㼶��
			if(node.name() == Node.STYLESET && !inHead) {
				styleset(true, node);
			}
			else if(node.name() == Node.BLOCK && !inHead) {
				block(true, node);
			}
			isSelectors = node.name() == Node.SELECTORS;
			isSelector = node.name() == Node.SELECTOR;
			//�ݹ��ӽڵ�
			node.leaves().forEach(function(leaf, i) {
				join(leaf, ignore, inHead, isSelectors, isSelector);
			});
			if(node.name() == Node.STYLESET & !inHead) {
				styleset(false, node);
			}
			else if(node.name() == Node.BLOCK && !inHead) {
				block(false, node);
			}
		}
	}
	function concatSt(i, s, arr, needTrim) {
		if(i == stack.length) {
			arr.push(s);
		}
		else {
			for(var j = 0, se = stack[i], len = se.length; j < len; j++) {
				var ns = s + (s.length && !/.*\s$/.test(s) ? ' ' : '') + (needTrim ? se[j].trim() : se[j]);
				concatSt(i + 1, ns, arr, needTrim);
			}
		}
		return arr;
	}
	function styleset(startOrEnd, node) {
		if(startOrEnd) {
			//����������ѡ�����Ƚ����ϼ�block
			if(stack.length) {
				res += '}';
			}
			stack.push(['']);
		}
		else {
			stack.pop();
			if(stack.length) {
				res += concatSt(0, '', [], true).join(',') + '{';
			}
		}
	}
	function block(startOrEnd, node) {
		if(startOrEnd) {
			res += concatSt(0, '', [], stack.length > 1).join(',');
		}
		else {
		}
	}

	exports.parse = function(code) {
		var lexer = new CssLexer(new CssRule()),
			parser = new Parser(lexer),
			ignore = {};
		try {
			token = lexer.parse(code);
			node = parser.program();
			ignore = parser.ignore();
		} catch(e) {
			if(window.console) {
				console.error(e);
			}
			return e.toString();
		}
		init(ignore);
		join(node, ignore);
		return character.escapeHTML(res);
	};
	exports.tree = function() {
		return node;
	};
	exports.token = function() {
		return token;
	};
});